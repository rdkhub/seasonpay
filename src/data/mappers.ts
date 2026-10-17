import type { EmployerPayConfig, ShiftInput } from '@/domain';
import type { EmployerRow, ShiftRow } from './db';

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

export function toEmployerConfig(e: EmployerRow): EmployerPayConfig {
  return {
    id: e.id,
    hourlyRateCents: e.hourlyRateCents,
    workweekStartDay: e.workweekStartDay,
    overtime: {
      enabled: e.overtimeEnabled,
      weeklyThresholdHours: e.overtimeThresholdHours,
      multiplier: e.overtimeMultiplier,
    },
  };
}
