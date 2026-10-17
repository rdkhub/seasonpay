import type { EpochMs } from './types';

/** Utilidades de fecha en hora local del dispositivo. Puras: no leen el reloj. */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;

export function startOfDay(ms: EpochMs): EpochMs {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Suma días respetando cambios de horario (DST): usa el calendario, no 24 h fijas. */
export function addDays(ms: EpochMs, days: number): EpochMs {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Inicio (00:00 local) de la semana que contiene `ms`, empezando en `startDay` (0 = domingo). */
export function startOfWeek(ms: EpochMs, startDay: number): EpochMs {
  const day0 = startOfDay(ms);
  const dow = new Date(day0).getDay();
  const diff = (dow - normalizeDay(startDay) + 7) % 7;
  return addDays(day0, -diff);
}

export function weekRange(ms: EpochMs, startDay: number): { from: EpochMs; to: EpochMs } {
  const from = startOfWeek(ms, startDay);
  return { from, to: addDays(from, 7) };
}

/** yyyy-mm-dd en hora local */
export function dayKey(ms: EpochMs): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Convierte yyyy-mm-dd + HH:mm (hora local) a epoch ms. Devuelve null si el texto no es válido. */
export function localDateTime(dateKey: string, hhmm: string): EpochMs | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!dm || !tm) return null;
  const [, y, mo, d] = dm;
  const [, h, mi] = tm;
  const hour = Number(h);
  const minute = Number(mi);
  if (hour > 23 || minute > 59) return null;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), hour, minute, 0, 0);
  if (date.getDate() !== Number(d)) return null;
  return date.getTime();
}

/** HH:mm en hora local */
export function timeKey(ms: EpochMs): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function normalizeDay(day: number): number {
  return ((Math.trunc(day) % 7) + 7) % 7;
}
