import type { EmployerPayConfig, ShiftInput } from '../types';

/**
 * Fixtures de prueba. La política de overtime aquí es un dato de prueba con los
 * mismos valores que el registro "overtime_weekly" de src/data/seed/rules.json,
 * pero el dominio nunca la lee de aquí.
 */
export const TEST_OT = { enabled: true, weeklyThresholdHours: 40, multiplier: 1.5 };

/** Fecha local (zona America/Denver fijada en vite.config.ts) */
export const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

export function employer(id: string, rate: number, overrides: Partial<EmployerPayConfig> = {}): EmployerPayConfig {
  return { id, hourlyRateCents: rate, workweekStartDay: 1, overtime: { ...TEST_OT }, ...overrides };
}

let n = 0;
export function shift(employerId: string, start: number, end: number | null, extra: Partial<ShiftInput> = {}): ShiftInput {
  n += 1;
  return { id: `s${n}`, employerId, start, end, breakMinutes: 0, cashTipsCents: 0, cardTipsCents: 0, ...extra };
}

/** Lunes 19 oct 2026 a domingo 25 oct 2026 */
export const WEEK = { from: at(2026, 10, 19), to: at(2026, 10, 26) };
