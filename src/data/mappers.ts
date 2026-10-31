import type { EmployerPayConfig, ShiftInput } from '@/domain';
import type { EmployerRow, ShiftRow, TaxRuleRow } from './db';

/** Traduce filas de Dexie a los tipos del dominio. El dominio no conoce Dexie. */

export function toShiftInput(s: ShiftRow): ShiftInput {
  return {
    id: s.id,
    employerId: s.employerId,
    start: s.startedAt,
    end: s.endedAt,
    breakMinutes: s.breakMinutes,
    cashTipsCents: s.cashTipsCents,
    cardTipsCents: s.cardTipsCents,
  };
}

/**
 * Reglas extra de overtime del estado del usuario (tax_rules → overtime_state): doble tiempo y 7.º día.
 * Se aplican a todos sus empleadores con overtime activado.
 */
export interface StatePremium {
  dailyDoubleTimeHours: number | null;
  doubleTimeMultiplier: number | null;
  seventhDay: 'ca' | 'ky' | null;
  seventhDayMinWeeklyHours: number | null;
}

export function statePremium(rules: TaxRuleRow[] | undefined, state: string | null | undefined): StatePremium | null {
  if (!state || !rules) return null;
  const rule = rules.filter((r) => r.key === 'overtime_state' && r.jurisdiction === state).sort((a, b) => b.year - a.year)[0];
  if (!rule) return null;
  const v = rule.value as {
    daily_double_time_hours?: number | null;
    double_time_multiplier?: number | null;
    seventh_day_rule?: string | null;
    seventh_day_min_weekly_hours?: number | null;
  };
  const seventh = v.seventh_day_rule === 'ca' || v.seventh_day_rule === 'ky' ? v.seventh_day_rule : null;
  if (!v.daily_double_time_hours && !seventh) return null;
  return {
    dailyDoubleTimeHours: v.daily_double_time_hours && v.double_time_multiplier ? v.daily_double_time_hours : null,
    doubleTimeMultiplier: v.double_time_multiplier ?? null,
    seventhDay: seventh,
    seventhDayMinWeeklyHours: v.seventh_day_min_weekly_hours ?? null,
  };
}

export function toEmployerConfig(e: EmployerRow, premium: StatePremium | null = null): EmployerPayConfig {
  return {
    id: e.id,
    hourlyRateCents: e.hourlyRateCents,
    workweekStartDay: e.workweekStartDay,
    overtime: {
      enabled: e.overtimeEnabled,
      weeklyThresholdHours: e.overtimeThresholdHours,
      multiplier: e.overtimeMultiplier,
      dailyThresholdHours: e.overtimeDailyHours ?? null,
      // El doble tiempo diario solo aplica si el empleador tiene overtime diario (si lo apagaste, no se suma).
      dailyDoubleTimeHours: e.overtimeDailyHours ? (premium?.dailyDoubleTimeHours ?? null) : null,
      doubleTimeMultiplier: premium?.doubleTimeMultiplier ?? null,
      seventhDay: premium?.seventhDay ?? null,
      seventhDayMinWeeklyHours: premium?.seventhDayMinWeeklyHours ?? null,
    },
  };
}
