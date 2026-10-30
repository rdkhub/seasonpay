import { splitByWorkweek } from './shifts';
import { dayKey } from './time';
import type { EmployerPayConfig, EpochMs, ShiftInput } from './types';

export interface MinuteAllocation {
  regularMinutes: number;
  overtimeMinutes: number;
}

/**
 * Reparte los minutos de cada turno entre horas normales y extra.
 *
 * Cómo funciona:
 * - Se calcula por empleador. Las horas con un empleador no suman al umbral de otro.
 * - Cada empleador tiene su semana laboral fija (workweekStartDay). No se promedia entre semanas.
 * - Dentro de cada semana, los minutos se acumulan en orden cronológico; todo lo que pasa
 *   del umbral (weeklyThresholdHours) es overtime.
 * - Si el empleador tiene el overtime apagado, todo es normal.
 * - Overtime diario (si el estado lo tiene): lo que pasa de dailyThresholdHours en un día es
 *   overtime. Esas horas ya no cuentan para el umbral semanal (no se pagan dos veces).
 *   El día es el del inicio del turno (un turno nocturno cuenta para el día en que empezó).
 *
 * El umbral y el multiplicador llegan como datos (tax_rules), no están escritos aquí.
 */
export function allocateOvertime(
  shifts: ShiftInput[],
  employers: Map<string, EmployerPayConfig>,
  now: EpochMs,
): Map<string, MinuteAllocation> {
  const result = new Map<string, MinuteAllocation>();
  for (const s of shifts) result.set(s.id, { regularMinutes: 0, overtimeMinutes: 0 });

  const byEmployer = new Map<string, ShiftInput[]>();
  for (const s of shifts) {
    const list = byEmployer.get(s.employerId) ?? [];
    list.push(s);
    byEmployer.set(s.employerId, list);
  }

  for (const [employerId, list] of byEmployer) {
    const cfg = employers.get(employerId);
    const startDay = cfg?.workweekStartDay ?? 0;
    const policy = cfg?.overtime;
    const thresholdMinutes =
      policy && policy.enabled && policy.weeklyThresholdHours > 0 ? Math.round(policy.weeklyThresholdHours * 60) : Infinity;
    const dailyMinutes =
      policy && policy.enabled && policy.dailyThresholdHours && policy.dailyThresholdHours > 0 ? Math.round(policy.dailyThresholdHours * 60) : Infinity;
    const shiftDay = new Map(list.map((s) => [s.id, dayKey(s.start)]));

    const segments = list.flatMap((s) => splitByWorkweek(s, startDay, now));
    segments.sort((a, b) => a.start - b.start || a.shiftId.localeCompare(b.shiftId));

    // Minutos "no diarios" acumulados por semana y minutos trabajados por día.
    const accumulated = new Map<EpochMs, number>();
    const perDay = new Map<string, number>();
    for (const seg of segments) {
      const day = shiftDay.get(seg.shiftId)!;
      const dayBefore = perDay.get(day) ?? 0;
      perDay.set(day, dayBefore + seg.minutes);
      const dailyOvertime = seg.minutes - Math.min(seg.minutes, Math.max(0, dailyMinutes - dayBefore));
      const candidate = seg.minutes - dailyOvertime;

      const before = accumulated.get(seg.weekStart) ?? 0;
      accumulated.set(seg.weekStart, before + candidate);

      const regularRoom = Math.max(0, thresholdMinutes - before);
      const regular = Math.min(candidate, regularRoom);
      const overtime = seg.minutes - regular;

      const alloc = result.get(seg.shiftId)!;
      alloc.regularMinutes += regular;
      alloc.overtimeMinutes += overtime;
    }
  }

  return result;
}
