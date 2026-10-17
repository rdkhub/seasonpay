import { addDays, localDateTime, MINUTE_MS, startOfWeek } from './time';
import type { EpochMs, ShiftInput } from './types';

/** Minutos brutos entre inicio y fin (sin restar descanso). */
export function spanMinutes(start: EpochMs, end: EpochMs): number {
  return Math.max(0, Math.round((end - start) / MINUTE_MS));
}

/**
 * Minutos trabajados: duración menos descanso. Un turno en curso usa `now` como fin.
 * Nunca negativo.
 */
export function workedMinutes(shift: Pick<ShiftInput, 'start' | 'end' | 'breakMinutes'>, now: EpochMs): number {
  const end = shift.end ?? Math.max(now, shift.start);
  return Math.max(0, spanMinutes(shift.start, end) - Math.max(0, Math.round(shift.breakMinutes)));
}

export interface ResolvedTimes {
  start: EpochMs;
  end: EpochMs;
  crossesMidnight: boolean;
}

/**
 * Turno cargado a mano: fecha de inicio + hora de inicio + hora de fin.
 * Si la hora de fin es menor o igual a la de inicio, el turno termina al día siguiente
 * (ej. 22:00 → 06:00). Devuelve null si los textos no son válidos.
 */
export function resolveShiftTimes(dateKey: string, startHHMM: string, endHHMM: string): ResolvedTimes | null {
  const start = localDateTime(dateKey, startHHMM);
  let end = localDateTime(dateKey, endHHMM);
  if (start === null || end === null) return null;
  let crossesMidnight = false;
  if (end <= start) {
    const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
    const next = addDays(new Date(y, m - 1, d).getTime(), 1);
    const nd = new Date(next);
    const nextKey = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
    end = localDateTime(nextKey, endHHMM);
    if (end === null) return null;
    crossesMidnight = true;
  }
  return { start, end, crossesMidnight };
}

export type ShiftValidationError =
  | 'end_before_start'
  | 'break_too_long'
  | 'too_long'
  | 'negative_tips'
  | 'negative_break';

/** Máximo razonable para un turno: 24 h. Es un límite de validación, no una regla laboral. */
const MAX_SHIFT_MINUTES = 24 * 60;

export function validateShift(shift: Pick<ShiftInput, 'start' | 'end' | 'breakMinutes' | 'cashTipsCents' | 'cardTipsCents'>): ShiftValidationError[] {
  const errors: ShiftValidationError[] = [];
  if (shift.breakMinutes < 0) errors.push('negative_break');
  if (shift.cashTipsCents < 0 || shift.cardTipsCents < 0) errors.push('negative_tips');
  if (shift.end !== null) {
    if (shift.end <= shift.start) errors.push('end_before_start');
    else {
      const span = spanMinutes(shift.start, shift.end);
      if (span > MAX_SHIFT_MINUTES) errors.push('too_long');
      if (shift.breakMinutes >= span) errors.push('break_too_long');
    }
  }
  return errors;
}

export interface WorkweekSegment {
  shiftId: string;
  weekStart: EpochMs;
  start: EpochMs;
  minutes: number;
}

/**
 * Parte un turno en los tramos que caen en cada semana laboral del empleador.
 * Un turno de domingo 20:00 a lunes 04:00 con semana que empieza el lunes cuenta
 * 4 h en una semana y 4 h en la siguiente. El descanso se reparte en proporción.
 */
export function splitByWorkweek(shift: ShiftInput, workweekStartDay: number, now: EpochMs): WorkweekSegment[] {
  const end = shift.end ?? Math.max(now, shift.start);
  const totalWorked = workedMinutes(shift, now);
  const span = spanMinutes(shift.start, end);
  if (span === 0 || totalWorked === 0) return [];

  const raw: { weekStart: EpochMs; start: EpochMs; spanMin: number }[] = [];
  let cursor = shift.start;
  while (cursor < end) {
    const ws = startOfWeek(cursor, workweekStartDay);
    const boundary = addDays(ws, 7);
    const segEnd = Math.min(end, boundary);
    raw.push({ weekStart: ws, start: cursor, spanMin: (segEnd - cursor) / MINUTE_MS });
    cursor = segEnd;
  }

  // Repartir los minutos trabajados (enteros) proporcionalmente; el último tramo absorbe el redondeo.
  const totalSpan = raw.reduce((a, s) => a + s.spanMin, 0);
  let assigned = 0;
  return raw.map((s, i) => {
    const minutes = i === raw.length - 1 ? totalWorked - assigned : Math.round((s.spanMin / totalSpan) * totalWorked);
    assigned += minutes;
    return { shiftId: shift.id, weekStart: s.weekStart, start: s.start, minutes };
  });
}
