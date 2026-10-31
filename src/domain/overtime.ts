import { splitByWorkweek } from './shifts';
import { dayKey } from './time';
import type { EmployerPayConfig, EpochMs, ShiftInput } from './types';

export interface MinuteAllocation {
  regularMinutes: number;
  overtimeMinutes: number;
  /** Minutos a doble tiempo (California) */
  doubleTimeMinutes: number;
}

/**
 * Reparte los minutos de cada turno entre horas normales, extra (overtime) y doble tiempo.
 *
 * Cómo funciona:
 * - Se calcula por empleador. Las horas con un empleador no suman al umbral de otro.
 * - Cada empleador tiene su semana laboral fija (workweekStartDay). No se promedia entre semanas.
 * - Dentro de cada semana, los minutos se acumulan en orden cronológico; todo lo que pasa
 *   del umbral semanal (weeklyThresholdHours) es overtime.
 * - Si el empleador tiene el overtime apagado, todo es normal.
 * - Overtime diario (si el estado lo tiene): lo que pasa de dailyThresholdHours en un día es
 *   overtime, y lo que pasa de dailyDoubleTimeHours es doble tiempo (California).
 *   Esas horas ya no cuentan para el umbral semanal (no se pagan dos veces).
 *   El día es el del inicio del turno (un turno nocturno cuenta para el día en que empezó;
 *   así un turno largo de Colorado cuenta como "12 horas seguidas").
 * - Séptimo día seguido de trabajo en la semana laboral (los 7 días trabajados):
 *   California: las primeras 8 h son overtime y lo que pasa de 8 h es doble tiempo.
 *   Kentucky: las horas de ese día son overtime si en la semana se trabajó más de 40 h.
 *
 * Los umbrales y multiplicadores llegan como datos (tax_rules), no están escritos aquí.
 */
export function allocateOvertime(
  shifts: ShiftInput[],
  employers: Map<string, EmployerPayConfig>,
  now: EpochMs,
): Map<string, MinuteAllocation> {
  const result = new Map<string, MinuteAllocation>();
  for (const s of shifts) result.set(s.id, { regularMinutes: 0, overtimeMinutes: 0, doubleTimeMinutes: 0 });

  const byEmployer = new Map<string, ShiftInput[]>();
  for (const s of shifts) {
    const list = byEmployer.get(s.employerId) ?? [];
    list.push(s);
    byEmployer.set(s.employerId, list);
  }

  const toMin = (h: number | null | undefined) => (h && h > 0 ? Math.round(h * 60) : Infinity);

  for (const [employerId, list] of byEmployer) {
    const cfg = employers.get(employerId);
    const startDay = cfg?.workweekStartDay ?? 0;
    const policy = cfg?.overtime;
    const on = !!policy?.enabled;
    const weeklyMin = on ? toMin(policy!.weeklyThresholdHours) : Infinity;
    const dailyMin = on ? toMin(policy!.dailyThresholdHours) : Infinity;
    const dailyDtMin = on ? toMin(policy!.dailyDoubleTimeHours) : Infinity;
    const seventh = on ? (policy!.seventhDay ?? null) : null;
    const seventhMinWeekly = on ? toMin(policy!.seventhDayMinWeeklyHours ?? policy!.weeklyThresholdHours) : Infinity;
    const shiftDay = new Map(list.map((s) => [s.id, dayKey(s.start)]));

    const segments = list.flatMap((s) => splitByWorkweek(s, startDay, now));
    segments.sort((a, b) => a.start - b.start || a.shiftId.localeCompare(b.shiftId));

    // Pre-cálculo por semana: días trabajados y total de minutos (para el 7.º día).
    const weekDays = new Map<EpochMs, string[]>();
    const weekTotal = new Map<EpochMs, number>();
    for (const seg of segments) {
      if (seg.minutes <= 0) continue;
      const day = shiftDay.get(seg.shiftId)!;
      const days = weekDays.get(seg.weekStart) ?? [];
      if (!days.includes(day)) days.push(day);
      weekDays.set(seg.weekStart, days);
      weekTotal.set(seg.weekStart, (weekTotal.get(seg.weekStart) ?? 0) + seg.minutes);
    }
    /** El 7.º día: la semana tiene trabajo los 7 días y este es el último de ellos. */
    const isSeventhDay = (weekStart: EpochMs, day: string) => {
      const days = weekDays.get(weekStart) ?? [];
      return days.length >= 7 && [...days].sort()[6] === day;
    };

    const accumulated = new Map<EpochMs, number>();
    const perDay = new Map<string, number>();
    for (const seg of segments) {
      const day = shiftDay.get(seg.shiftId)!;
      const dayBefore = perDay.get(day) ?? 0;
      perDay.set(day, dayBefore + seg.minutes);
      const alloc = result.get(seg.shiftId)!;

      // Minutos de este tramo que caen en cada franja del día: [0, a) [a, b) [b, ∞)
      const band = (from: number, to: number) => Math.max(0, Math.min(dayBefore + seg.minutes, to) - Math.max(dayBefore, from));
      const seventhDay = seventh !== null && isSeventhDay(seg.weekStart, day);

      if (seventhDay && seventh === 'ca') {
        // California: primeras 8 h a 1.5x, el resto a 2x. Ya no suman a la semana.
        const firstEight = band(0, 8 * 60);
        alloc.overtimeMinutes += firstEight;
        alloc.doubleTimeMinutes += seg.minutes - firstEight;
        continue;
      }
      if (seventhDay && seventh === 'ky' && (weekTotal.get(seg.weekStart) ?? 0) > seventhMinWeekly) {
        alloc.overtimeMinutes += seg.minutes;
        continue;
      }

      const doubleTime = band(dailyDtMin, Infinity);
      const dailyOvertime = band(dailyMin, dailyDtMin);
      const candidate = seg.minutes - doubleTime - dailyOvertime;

      const before = accumulated.get(seg.weekStart) ?? 0;
      accumulated.set(seg.weekStart, before + candidate);
      const regular = Math.min(candidate, Math.max(0, weeklyMin - before));

      alloc.regularMinutes += regular;
      alloc.overtimeMinutes += seg.minutes - regular - doubleTime;
      alloc.doubleTimeMinutes += doubleTime;
    }
  }

  return result;
}
