import type { EmployerRow, ProfileRow, ShiftRow, SyncTable } from '../db';

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

/** Orden de subida: primero perfil y empleadores, después turnos (por la FK). */
export const PUSH_ORDER: SyncTable[] = ['profiles', 'employers', 'shifts'];
