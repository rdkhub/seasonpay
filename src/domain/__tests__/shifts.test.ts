import { describe, expect, it } from 'vitest';
import { resolveShiftTimes, splitByWorkweek, validateShift, workedMinutes } from '../shifts';
import { startOfWeek } from '../time';
import { at, shift } from './fixtures';

describe('workedMinutes', () => {
  it('resta el descanso', () => {
    const s = shift('a', at(2026, 10, 19, 9), at(2026, 10, 19, 17), { breakMinutes: 30 });
    expect(workedMinutes(s, 0)).toBe(7 * 60 + 30);
  });

  it('nunca da negativo aunque el descanso sea mayor', () => {
    const s = shift('a', at(2026, 10, 19, 9), at(2026, 10, 19, 10), { breakMinutes: 90 });
    expect(workedMinutes(s, 0)).toBe(0);
  });

  it('un turno en curso cuenta hasta ahora', () => {
    const s = shift('a', at(2026, 10, 19, 9), null);
    expect(workedMinutes(s, at(2026, 10, 19, 11, 15))).toBe(135);
  });
});

describe('resolveShiftTimes (cruce de medianoche)', () => {
  it('22:00 a 06:00 termina al día siguiente', () => {
    const r = resolveShiftTimes('2026-10-23', '22:00', '06:00')!;
    expect(r.crossesMidnight).toBe(true);
    expect(r.start).toBe(at(2026, 10, 23, 22));
    expect(r.end).toBe(at(2026, 10, 24, 6));
    expect(workedMinutes({ start: r.start, end: r.end, breakMinutes: 0 }, 0)).toBe(8 * 60);
  });

  it('turno normal no cruza', () => {
    const r = resolveShiftTimes('2026-10-23', '08:30', '16:00')!;
    expect(r.crossesMidnight).toBe(false);
    expect((r.end - r.start) / 60000).toBe(450);
  });

  it('cambio de horario (fin del DST, 1 nov 2026): 22:00 a 06:00 son 9 h reales', () => {
    const r = resolveShiftTimes('2026-10-31', '22:00', '06:00')!;
    expect(workedMinutes({ start: r.start, end: r.end, breakMinutes: 0 }, 0)).toBe(9 * 60);
  });

  it('rechaza horas inválidas', () => {
    expect(resolveShiftTimes('2026-10-23', '25:00', '06:00')).toBeNull();
    expect(resolveShiftTimes('2026-02-30', '08:00', '16:00')).toBeNull();
  });
});

describe('validateShift', () => {
  it('detecta descanso más largo que el turno', () => {
    const s = shift('a', at(2026, 10, 19, 9), at(2026, 10, 19, 10), { breakMinutes: 60 });
    expect(validateShift(s)).toContain('break_too_long');
  });
  it('detecta fin antes del inicio', () => {
    const s = shift('a', at(2026, 10, 19, 10), at(2026, 10, 19, 9));
    expect(validateShift(s)).toContain('end_before_start');
  });
  it('acepta un turno correcto', () => {
    const s = shift('a', at(2026, 10, 19, 9), at(2026, 10, 19, 17), { breakMinutes: 30, cashTipsCents: 2000 });
    expect(validateShift(s)).toEqual([]);
  });
});

describe('splitByWorkweek', () => {
  it('parte un turno que cruza el inicio de la semana laboral', () => {
    // Semana laboral empieza el lunes. Domingo 25 oct 20:00 → lunes 26 oct 04:00.
    const s = shift('a', at(2026, 10, 25, 20), at(2026, 10, 26, 4));
    const segs = splitByWorkweek(s, 1, 0);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.minutes).toBe(240);
    expect(segs[1]!.minutes).toBe(240);
    expect(segs[1]!.weekStart).toBe(startOfWeek(at(2026, 10, 26), 1));
  });

  it('reparte el descanso en proporción', () => {
    const s = shift('a', at(2026, 10, 25, 20), at(2026, 10, 26, 4), { breakMinutes: 60 });
    const segs = splitByWorkweek(s, 1, 0);
    expect(segs.map((x) => x.minutes)).toEqual([210, 210]);
  });
});
