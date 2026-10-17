import { useMemo } from 'react';
import { assessFica, type FicaAssessment, type FicaRules } from '@/domain';
import type { PaystubRow, ProfileRow, TaxRuleRow } from '@/data/db';

const num = (v: unknown) => (typeof v === 'number' ? v : null);

/** Arma las reglas de FICA desde tax_rules (nunca desde el código). */
export function ficaRulesFrom(rules: TaxRuleRow[] | undefined): FicaRules {
  const find = (key: string) =>
    (rules ?? []).filter((r) => r.key === key && r.jurisdiction === 'federal').sort((a, b) => b.year - a.year)[0];
  const exemption = find('fica_exemption_nonresident_fjmq')?.value as { visa_classes?: string[] } | undefined;
  return {
    studentYearsLimit: num(find('exempt_individual_student')?.value.calendar_years_limit),
    teacherTraineePriorYearsLimit: num(find('exempt_individual_teacher_trainee')?.value.max_prior_years),
    exemptVisaClasses: exemption?.visa_classes ?? [],
  };
}

/** Años previos en estatus F/J: lo que el usuario declaró o, si no, lo que sale del año de llegada. */
export function priorYearsOf(profile: ProfileRow | null | undefined, now: number): number | null {
  if (!profile) return null;
  if (profile.fjPriorYears !== null && profile.fjPriorYears !== undefined) return profile.fjPriorYears;
  if (!profile.arrivalYear) return null;
  return Math.max(0, new Date(now).getFullYear() - profile.arrivalYear);
}

export function useFica(profile: ProfileRow | null | undefined, rules: TaxRuleRow[] | undefined, paystubs: PaystubRow[] | undefined, now: number): FicaAssessment & { rules: FicaRules; priorYears: number | null; declared: boolean } {
  return useMemo(() => {
    const year = String(new Date(now).getFullYear());
    // Solo las boletas pagadas este año calendario.
    const withheld = (paystubs ?? []).filter((p) => p.payDate.startsWith(year)).reduce((a, p) => a + p.socialSecurityCents + p.medicareCents, 0);
    const r = ficaRulesFrom(rules);
    const priorYears = priorYearsOf(profile, now);
    return {
      ...assessFica({ visaType: profile?.visaType ?? null, priorYearsInStatus: priorYears, rules: r, withheldCents: withheld }),
      rules: r,
      priorYears,
      declared: profile?.fjPriorYears !== null && profile?.fjPriorYears !== undefined,
    };
  }, [profile, rules, paystubs, now]);
}
