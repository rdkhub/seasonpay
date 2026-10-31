import { isHomeCurrency } from '@/domain/currency';
import type { EmployerRow, PaystubRow, ProfileRow, SavingsRow, ShiftRow, SyncTable } from '../db';

/**
 * Conversión entre filas locales (camelCase, epoch ms) y filas de Postgres
 * (snake_case, timestamptz ISO). user_id lo pone RLS/default en el servidor,
 * pero lo mandamos explícito para que el WITH CHECK lo valide.
 */

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const ms = (s: string | null | undefined) => (s ? Date.parse(s) : null);

type Remote = Record<string, unknown>;

export function profileToRemote(p: ProfileRow, userId: string): Remote {
  return {
    id: userId,
    language: p.language,
    visa_type: p.visaType,
    arrival_year: p.arrivalYear,
    work_state: p.workState,
    fj_prior_years: p.fjPriorYears,
    savings_goal_cents: p.savingsGoalCents,
    checklist_done: p.checklistDone,
    consent_at: iso(p.consentAt),
    consent_version: p.consentVersion,
    analytics_opt_out: p.analyticsOptOut,
    home_currency: p.homeCurrency,
    onboarded_at: iso(p.onboardedAt),
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
  };
}

export function profileFromRemote(r: Remote): ProfileRow {
  return {
    id: 'me',
    language: (r.language as ProfileRow['language']) ?? 'system',
    visaType: (r.visa_type as ProfileRow['visaType']) ?? null,
    arrivalYear: (r.arrival_year as number | null) ?? null,
    workState: (r.work_state as string | null) ?? null,
    fjPriorYears: (r.fj_prior_years as number | null) ?? null,
    savingsGoalCents: (r.savings_goal_cents as number | null) ?? null,
    checklistDone: (r.checklist_done as string[] | null) ?? [],
    consentAt: ms(r.consent_at as string | null),
    consentVersion: (r.consent_version as string | null) ?? null,
    analyticsOptOut: (r.analytics_opt_out as boolean | null) ?? false,
    homeCurrency: isHomeCurrency(r.home_currency) ? r.home_currency : 'PEN',
    onboardedAt: ms(r.onboarded_at as string | null),
    createdAt: ms(r.created_at as string) ?? Date.now(),
    updatedAt: ms(r.updated_at as string) ?? 0,
  };
}

export function employerToRemote(e: EmployerRow, userId: string): Remote {
  return {
    id: e.id,
    user_id: userId,
    name: e.name,
    hourly_rate_cents: e.hourlyRateCents,
    pay_frequency: e.payFrequency,
    workweek_start_day: e.workweekStartDay,
    overtime_enabled: e.overtimeEnabled,
    overtime_threshold_hours: e.overtimeThresholdHours,
    overtime_multiplier: e.overtimeMultiplier,
    overtime_daily_hours: e.overtimeDailyHours,
    overtime_rule_key: e.overtimeRuleKey,
    archived: e.archived,
    created_at: iso(e.createdAt),
    updated_at: iso(e.updatedAt),
    deleted_at: iso(e.deletedAt),
  };
}

export function employerFromRemote(r: Remote): EmployerRow {
  return {
    id: r.id as string,
    name: r.name as string,
    hourlyRateCents: r.hourly_rate_cents as number,
    payFrequency: r.pay_frequency as EmployerRow['payFrequency'],
    workweekStartDay: r.workweek_start_day as number,
    overtimeEnabled: r.overtime_enabled as boolean,
    overtimeThresholdHours: Number(r.overtime_threshold_hours),
    overtimeMultiplier: Number(r.overtime_multiplier),
    overtimeDailyHours: r.overtime_daily_hours == null ? null : Number(r.overtime_daily_hours),
    overtimeRuleKey: (r.overtime_rule_key as string | null) ?? null,
    archived: r.archived as boolean,
    createdAt: ms(r.created_at as string) ?? Date.now(),
    updatedAt: ms(r.updated_at as string) ?? 0,
    deletedAt: ms(r.deleted_at as string | null),
  };
}

export function shiftToRemote(s: ShiftRow, userId: string): Remote {
  return {
    id: s.id,
    user_id: userId,
    employer_id: s.employerId,
    started_at: iso(s.startedAt),
    ended_at: iso(s.endedAt),
    break_minutes: s.breakMinutes,
    cash_tips_cents: s.cashTipsCents,
    card_tips_cents: s.cardTipsCents,
    note: s.note,
    created_at: iso(s.createdAt),
    updated_at: iso(s.updatedAt),
    deleted_at: iso(s.deletedAt),
  };
}

export function shiftFromRemote(r: Remote): ShiftRow {
  return {
    id: r.id as string,
    employerId: r.employer_id as string,
    startedAt: ms(r.started_at as string) ?? 0,
    endedAt: ms(r.ended_at as string | null),
    breakMinutes: r.break_minutes as number,
    cashTipsCents: r.cash_tips_cents as number,
    cardTipsCents: r.card_tips_cents as number,
    note: (r.note as string) ?? '',
    createdAt: ms(r.created_at as string) ?? Date.now(),
    updatedAt: ms(r.updated_at as string) ?? 0,
    deletedAt: ms(r.deleted_at as string | null),
  };
}

export function paystubToRemote(p: PaystubRow, userId: string): Remote {
  return {
    id: p.id,
    user_id: userId,
    employer_id: p.employerId,
    period_start: p.periodStart,
    period_end: p.periodEnd,
    pay_date: p.payDate,
    regular_minutes: p.regularMinutes,
    overtime_minutes: p.overtimeMinutes,
    gross_cents: p.grossCents,
    tips_cents: p.tipsCents,
    federal_tax_cents: p.federalTaxCents,
    state_tax_cents: p.stateTaxCents,
    social_security_cents: p.socialSecurityCents,
    medicare_cents: p.medicareCents,
    other_deductions_cents: p.otherDeductionsCents,
    net_cents: p.netCents,
    note: p.note,
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
    deleted_at: iso(p.deletedAt),
  };
}

export function paystubFromRemote(r: Remote): PaystubRow {
  return {
    id: r.id as string,
    employerId: r.employer_id as string,
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    payDate: r.pay_date as string,
    regularMinutes: r.regular_minutes as number,
    overtimeMinutes: r.overtime_minutes as number,
    grossCents: r.gross_cents as number,
    tipsCents: r.tips_cents as number,
    federalTaxCents: r.federal_tax_cents as number,
    stateTaxCents: r.state_tax_cents as number,
    socialSecurityCents: r.social_security_cents as number,
    medicareCents: r.medicare_cents as number,
    otherDeductionsCents: r.other_deductions_cents as number,
    netCents: r.net_cents as number,
    note: (r.note as string) ?? '',
    createdAt: ms(r.created_at as string) ?? Date.now(),
    updatedAt: ms(r.updated_at as string) ?? 0,
    deletedAt: ms(r.deleted_at as string | null),
  };
}

export function savingsToRemote(s: SavingsRow, userId: string): Remote {
  return {
    id: s.id,
    user_id: userId,
    kind: s.kind,
    date: s.date,
    amount_cents: s.amountCents,
    fx_rate: s.fxRate,
    fx_date: s.fxDate,
    fx_source: s.fxSource,
    fx_currency: s.fxCurrency,
    note: s.note,
    created_at: iso(s.createdAt),
    updated_at: iso(s.updatedAt),
    deleted_at: iso(s.deletedAt),
  };
}

export function savingsFromRemote(r: Remote): SavingsRow {
  return {
    id: r.id as string,
    kind: r.kind as SavingsRow['kind'],
    date: r.date as string,
    amountCents: r.amount_cents as number,
    fxRate: r.fx_rate === null || r.fx_rate === undefined ? null : Number(r.fx_rate),
    fxDate: (r.fx_date as string | null) ?? null,
    fxSource: (r.fx_source as SavingsRow['fxSource']) ?? null,
    fxCurrency: isHomeCurrency(r.fx_currency) ? r.fx_currency : 'PEN',
    note: (r.note as string) ?? '',
    createdAt: ms(r.created_at as string) ?? Date.now(),
    updatedAt: ms(r.updated_at as string) ?? 0,
    deletedAt: ms(r.deleted_at as string | null),
  };
}

/** Orden de subida: perfil y empleadores primero; turnos, boletas y ahorro después (por la FK). */
export const PUSH_ORDER: SyncTable[] = ['profiles', 'employers', 'shifts', 'paystubs', 'savings'];
