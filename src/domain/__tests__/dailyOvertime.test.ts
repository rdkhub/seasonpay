import { describe, expect, it } from 'vitest';
import { allocateOvertime } from '../overtime';
import type { EmployerPayConfig, ShiftInput } from '../types';

// Semana que empieza el lunes 5-ene-2026 (TZ de pruebas: America/Denver).
const at = (day: number, h: number) => new Date(2026, 0, 5 + day, h, 0, 0).getTime();
const shift = (id: string, day: number, from: number, to: number): ShiftInput => ({
  id, employerId: 'e', start: at(day, from), end: at(day, to), breakMinutes: 0, cashTipsCents: 0, cardTipsCents: 0,
});
const cfg = (daily: number | null): Map<string, EmployerPayConfig> =>
  new Map([['e', { id: 'e', hourlyRateCents: 2000, workweekStartDay: 1, overtime: { enabled: true, weeklyThresholdHours: 40, multiplier: 1.5, dailyThresholdHours: daily } }]]);
const now = at(14, 0);

describe('overtime diario', () => {
  it('California (8 h/día): un día de 10 h da 2 h de overtime aunque la semana no llegue a 40', () => {
    const r = allocateOvertime([shift('a', 0, 8, 18)], cfg(8), now).get('a')!;
    expect(r).toEqual({ regularMinutes: 480, overtimeMinutes: 120, doubleTimeMinutes: 0 });
  });

  it('sin regla diaria el mismo día es todo normal', () => {
    const r = allocateOvertime([shift('a', 0, 8, 18)], cfg(null), now).get('a')!;
    expect(r).toEqual({ regularMinutes: 600, overtimeMinutes: 0, doubleTimeMinutes: 0 });
  });

  it('dos turnos el mismo día suman para el umbral diario', () => {
    const m = allocateOvertime([shift('a', 0, 6, 11), shift('b', 0, 16, 21)], cfg(8), now);
    expect(m.get('a')).toEqual({ regularMinutes: 300, overtimeMinutes: 0, doubleTimeMinutes: 0 });
    expect(m.get('b')).toEqual({ regularMinutes: 180, overtimeMinutes: 120, doubleTimeMinutes: 0 });
  });

  it('no se paga dos veces: las horas extra diarias no cuentan para las 40 semanales', () => {
    // 5 días de 10 h = 50 h. Diario: 2 h x 5 = 10 h extra. Quedan 40 h normales: semanal no suma nada.
    const shifts = [0, 1, 2, 3, 4].map((d) => shift(`d${d}`, d, 8, 18));
    const m = allocateOvertime(shifts, cfg(8), now);
    const reg = [...m.values()].reduce((a, x) => a + x.regularMinutes, 0);
    const ot = [...m.values()].reduce((a, x) => a + x.overtimeMinutes, 0);
    expect(reg).toBe(40 * 60);
    expect(ot).toBe(10 * 60);
  });

  it('semanal sigue funcionando: 6 días de 8 h con regla diaria de 8 dan 8 h de overtime semanal', () => {
    const shifts = [0, 1, 2, 3, 4, 5].map((d) => shift(`d${d}`, d, 8, 16));
    const m = allocateOvertime(shifts, cfg(8), now);
    expect(m.get('d5')).toEqual({ regularMinutes: 0, overtimeMinutes: 480, doubleTimeMinutes: 0 });
    expect([...m.values()].reduce((a, x) => a + x.overtimeMinutes, 0)).toBe(480);
  });

  it('Colorado (12 h/día): un día de 13 h da 1 h de overtime', () => {
    const r = allocateOvertime([shift('a', 2, 6, 19)], cfg(12), now).get('a')!;
    expect(r).toEqual({ regularMinutes: 720, overtimeMinutes: 60, doubleTimeMinutes: 0 });
  });
});

// California completo (Labor Code 510, DLSE): doble tiempo después de 12 h y 7.º día seguido.
const ca: Map<string, EmployerPayConfig> = new Map([
  ['e', { id: 'e', hourlyRateCents: 2000, workweekStartDay: 1, overtime: { enabled: true, weeklyThresholdHours: 40, multiplier: 1.5, dailyThresholdHours: 8, dailyDoubleTimeHours: 12, doubleTimeMultiplier: 2, seventhDay: 'ca' } }],
]);
const ky: Map<string, EmployerPayConfig> = new Map([
  ['e', { id: 'e', hourlyRateCents: 2000, workweekStartDay: 1, overtime: { enabled: true, weeklyThresholdHours: 40, multiplier: 1.5, seventhDay: 'ky', seventhDayMinWeeklyHours: 40 } }],
]);

describe('California: doble tiempo y 7.º día', () => {
  it('un día de 14 h: 8 normales, 4 a 1.5x y 2 a doble tiempo', () => {
    expect(allocateOvertime([shift('a', 0, 6, 20)], ca, now).get('a')).toEqual({ regularMinutes: 480, overtimeMinutes: 240, doubleTimeMinutes: 120 });
  });

  it('dos turnos el mismo día que pasan de 12 h', () => {
    const m = allocateOvertime([shift('a', 0, 6, 14), shift('b', 0, 15, 21)], ca, now);
    expect(m.get('a')).toEqual({ regularMinutes: 480, overtimeMinutes: 0, doubleTimeMinutes: 0 });
    expect(m.get('b')).toEqual({ regularMinutes: 0, overtimeMinutes: 240, doubleTimeMinutes: 120 });
  });

  it('7 días seguidos de 6 h: el 7.º día es todo overtime (menos de 8 h)', () => {
    const m = allocateOvertime([0, 1, 2, 3, 4, 5, 6].map((d) => shift(`d${d}`, d, 8, 14)), ca, now);
    expect(m.get('d6')).toEqual({ regularMinutes: 0, overtimeMinutes: 360, doubleTimeMinutes: 0 });
    expect(m.get('d5')).toEqual({ regularMinutes: 360, overtimeMinutes: 0, doubleTimeMinutes: 0 });
  });

  it('7.º día de 10 h: 8 h a 1.5x y 2 h a doble tiempo', () => {
    const shifts = [0, 1, 2, 3, 4, 5].map((d) => shift(`d${d}`, d, 8, 12)).concat(shift('d6', 6, 8, 18));
    expect(allocateOvertime(shifts, ca, now).get('d6')).toEqual({ regularMinutes: 0, overtimeMinutes: 480, doubleTimeMinutes: 120 });
  });

  it('6 días no activan la regla del 7.º día', () => {
    const m = allocateOvertime([0, 1, 2, 3, 4, 5].map((d) => shift(`d${d}`, d, 8, 14)), ca, now);
    expect([...m.values()].reduce((a, x) => a + x.overtimeMinutes + x.doubleTimeMinutes, 0)).toBe(0);
  });
});

describe('Kentucky: 7.º día', () => {
  it('7 días con más de 40 h en la semana: el 7.º día es overtime', () => {
    const shifts = [0, 1, 2, 3, 4, 5, 6].map((d) => shift(`d${d}`, d, 8, 15)); // 7 h x 7 = 49 h
    const m = allocateOvertime(shifts, ky, now);
    expect(m.get('d6')).toEqual({ regularMinutes: 0, overtimeMinutes: 420, doubleTimeMinutes: 0 });
    // Las primeras 6 jornadas: 42 h → 2 h de overtime semanal en el 6.º día
    expect(m.get('d5')).toEqual({ regularMinutes: 300, overtimeMinutes: 120, doubleTimeMinutes: 0 });
  });

  it('7 días sin pasar de 40 h: no aplica (excepción de KRS 337.050)', () => {
    const m = allocateOvertime([0, 1, 2, 3, 4, 5, 6].map((d) => shift(`d${d}`, d, 8, 13)), ky, now); // 35 h
    expect(m.get('d6')).toEqual({ regularMinutes: 300, overtimeMinutes: 0, doubleTimeMinutes: 0 });
  });
});
