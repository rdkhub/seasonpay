import { addDays, dayKey, startOfWeek } from '@/domain';
import type { EmployerRow, PaystubRow } from '@/data/db';
import type { PaystubDraft } from '@/data/repos/paystubs';
import { centsToInput, parseMoneyInput } from '@/shared/lib/money';

/** Estado y validación del formulario de boleta (sin React). */

export interface PaystubFormValue {
  employerId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  regularHours: string;
  overtimeHours: string;
  gross: string;
  tips: string;
  federalTax: string;
  stateTax: string;
  socialSecurity: string;
  medicare: string;
  otherDeductions: string;
  net: string;
  note: string;
}

export type PaystubFormErrors = Partial<Record<keyof PaystubFormValue | 'period', string>>;

/** "40" → 2400 · "5.5" → 330 · "7,25" → 435 · "" → 0. null si no es válido. */
export function parseHoursInput(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return 0;
  if (!/^\d{1,3}(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 60);
}

export function minutesToHoursInput(minutes: number): string {
  if (minutes === 0) return '';
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100);
}

/** Periodo sugerido: el último periodo de pago completo según la frecuencia del empleador. */
export function suggestedPeriod(employer: EmployerRow | undefined, now: number): { start: string; end: string } {
  const freq = employer?.payFrequency ?? 'biweekly';
  if (freq === 'weekly' || freq === 'biweekly') {
    const weekStart = startOfWeek(now, employer?.workweekStartDay ?? 1);
    const end = addDays(weekStart, -1);
    const start = addDays(weekStart, freq === 'weekly' ? -7 : -14);
    return { start: dayKey(start), end: dayKey(end) };
  }
  const d = new Date(now);
  if (freq === 'semimonthly') {
    if (d.getDate() > 15) return { start: dayKey(new Date(d.getFullYear(), d.getMonth(), 1).getTime()), end: dayKey(new Date(d.getFullYear(), d.getMonth(), 15).getTime()) };
    return {
      start: dayKey(new Date(d.getFullYear(), d.getMonth() - 1, 16).getTime()),
      end: dayKey(new Date(d.getFullYear(), d.getMonth(), 0).getTime()),
    };
  }
  return {
    start: dayKey(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()),
    end: dayKey(new Date(d.getFullYear(), d.getMonth(), 0).getTime()),
  };
}

export function emptyPaystubForm(employer: EmployerRow | undefined, now: number): PaystubFormValue {
  const p = suggestedPeriod(employer, now);
  return {
    employerId: employer?.id ?? '',
    periodStart: p.start,
    periodEnd: p.end,
    payDate: dayKey(now),
    regularHours: '',
    overtimeHours: '',
    gross: '',
    tips: '',
    federalTax: '',
    stateTax: '',
    socialSecurity: '',
    medicare: '',
    otherDeductions: '',
    net: '',
    note: '',
  };
}

export function paystubToForm(p: PaystubRow): PaystubFormValue {
  return {
    employerId: p.employerId,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    payDate: p.payDate,
    regularHours: minutesToHoursInput(p.regularMinutes),
    overtimeHours: minutesToHoursInput(p.overtimeMinutes),
    gross: centsToInput(p.grossCents),
    tips: centsToInput(p.tipsCents),
    federalTax: centsToInput(p.federalTaxCents),
    stateTax: centsToInput(p.stateTaxCents),
    socialSecurity: centsToInput(p.socialSecurityCents),
    medicare: centsToInput(p.medicareCents),
    otherDeductions: centsToInput(p.otherDeductionsCents),
    net: centsToInput(p.netCents),
    note: p.note,
  };
}

const MONEY_FIELDS = ['gross', 'tips', 'federalTax', 'stateTax', 'socialSecurity', 'medicare', 'otherDeductions', 'net'] as const;

export function validatePaystubForm(v: PaystubFormValue): { errors: PaystubFormErrors; draft: PaystubDraft | null } {
  const errors: PaystubFormErrors = {};
  if (!v.employerId) errors.employerId = 'paystubs.errors.employer';
  if (!v.periodStart || !v.periodEnd || v.periodEnd < v.periodStart) errors.period = 'paystubs.errors.period';
  if (!v.payDate) errors.payDate = 'paystubs.errors.payDate';

  const regular = parseHoursInput(v.regularHours);
  const overtime = parseHoursInput(v.overtimeHours);
  if (regular === null) errors.regularHours = 'paystubs.errors.hours';
  if (overtime === null) errors.overtimeHours = 'paystubs.errors.hours';

  const money: Record<(typeof MONEY_FIELDS)[number], number> = {} as never;
  for (const f of MONEY_FIELDS) {
    const c = parseMoneyInput(v[f]);
    if (c === null) errors[f] = 'shiftForm.errors.money';
    else money[f] = c;
  }
  if (!errors.gross && money.gross === 0) errors.gross = 'paystubs.errors.gross';

  if (Object.keys(errors).length > 0) return { errors, draft: null };
  return {
    errors,
    draft: {
      employerId: v.employerId,
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      payDate: v.payDate,
      regularMinutes: regular!,
      overtimeMinutes: overtime!,
      grossCents: money.gross,
      tipsCents: money.tips,
      federalTaxCents: money.federalTax,
      stateTaxCents: money.stateTax,
      socialSecurityCents: money.socialSecurity,
      medicareCents: money.medicare,
      otherDeductionsCents: money.otherDeductions,
      netCents: money.net,
      note: v.note.trim(),
    },
  };
}
