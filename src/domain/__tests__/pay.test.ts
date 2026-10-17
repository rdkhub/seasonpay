import { describe, expect, it } from 'vitest';
import { payForMinutes, summarizePeriod } from '../pay';
import { at, employer, shift, WEEK } from './fixtures';

/** Cinco turnos de 9 h (lun a vie) = 45 h */
function fiveNineHourDays(employerId: string, startDay = 19) {
  return Array.from({ length: 5 }, (_, i) => shift(employerId, at(2026, 10, startDay + i, 8), at(2026, 10, startDay + i, 17)));
}

describe('payForMinutes', () => {
  it('redondea al centavo', () => {
    expect(payForMinutes(60, 1550)).toBe(1550);
    expect(payForMinutes(61, 1550)).toBe(1576); // 1550 * 61 / 60 = 1575.83
    expect(payForMinutes(60, 1550, 1.5)).toBe(2325);
  });
});

describe('summarizePeriod: overtime semanal', () => {
  it('45 h con un empleador → 40 normales + 5 extra a 1.5x', () => {
    const emp = employer('a', 1600);
    const r = summarizePeriod({ shifts: fiveNineHourDays('a'), employers: [emp], range: WEEK, now: 0 });
    expect(r.regularMinutes).toBe(40 * 60);
    expect(r.overtimeMinutes).toBe(5 * 60);
    expect(r.basePayCents).toBe(40 * 1600);
    expect(r.overtimePayCents).toBe(5 * 2400);
    expect(r.grossCents).toBe(64000 + 12000);
  });

  it('el overtime cae en los últimos turnos de la semana (orden cronológico)', () => {
    const shifts = fiveNineHourDays('a');
    const r = summarizePeriod({ shifts, employers: [employer('a', 1600)], range: WEEK, now: 0 });
    expect(r.byShift.get(shifts[3]!.id)!.overtimeMinutes).toBe(0);
    expect(r.byShift.get(shifts[4]!.id)!.overtimeMinutes).toBe(5 * 60);
  });

  it('exactamente 40 h → sin overtime', () => {
    const shifts = Array.from({ length: 5 }, (_, i) => shift('a', at(2026, 10, 19 + i, 9), at(2026, 10, 19 + i, 17)));
    const r = summarizePeriod({ shifts, employers: [employer('a', 1500)], range: WEEK, now: 0 });
    expect(r.overtimeMinutes).toBe(0);
  });

  it('con overtime apagado todo es normal', () => {
    const emp = employer('a', 1600, { overtime: { enabled: false, weeklyThresholdHours: 40, multiplier: 1.5 } });
    const r = summarizePeriod({ shifts: fiveNineHourDays('a'), employers: [emp], range: WEEK, now: 0 });
    expect(r.overtimeMinutes).toBe(0);
    expect(r.basePayCents).toBe(45 * 1600);
  });

  it('los descansos no cuentan para el umbral', () => {
    const shifts = fiveNineHourDays('a').map((s) => ({ ...s, breakMinutes: 60 }));
    const r = summarizePeriod({ shifts, employers: [employer('a', 1600)], range: WEEK, now: 0 });
    expect(r.workedMinutes).toBe(40 * 60);
    expect(r.overtimeMinutes).toBe(0);
  });

  it('no promedia entre semanas: 50 h y 30 h → 10 h extra en la primera', () => {
    const w1 = Array.from({ length: 5 }, (_, i) => shift('a', at(2026, 10, 19 + i, 7), at(2026, 10, 19 + i, 17)));
    const w2 = Array.from({ length: 5 }, (_, i) => shift('a', at(2026, 10, 26 + i, 9), at(2026, 10, 26 + i, 15)));
    const all = [...w1, ...w2];
    const r1 = summarizePeriod({ shifts: all, employers: [employer('a', 1000)], range: WEEK, now: 0 });
    const r2 = summarizePeriod({ shifts: all, employers: [employer('a', 1000)], range: { from: at(2026, 10, 26), to: at(2026, 11, 2) }, now: 0 });
    expect(r1.overtimeMinutes).toBe(10 * 60);
    expect(r2.overtimeMinutes).toBe(0);
  });
});

describe('summarizePeriod: cruce de medianoche y semana laboral', () => {
  it('turno nocturno que cruza el inicio de la semana laboral suma horas a la semana siguiente', () => {
    // Semana laboral del empleador: lunes. Ya trabajó 40 h de lun a vie (26–30 oct).
    // El domingo 25 oct 22:00 → lunes 26 06:00: 2 h en la semana anterior, 6 h en la nueva.
    const emp = employer('a', 1000);
    const night = shift('a', at(2026, 10, 25, 22), at(2026, 10, 26, 6));
    const week2 = Array.from({ length: 5 }, (_, i) => shift('a', at(2026, 10, 26 + i, 9), at(2026, 10, 26 + i, 17)));
    const r = summarizePeriod({ shifts: [night, ...week2], employers: [emp], range: { from: at(2026, 10, 26), to: at(2026, 11, 2) }, now: 0 });
    // Las 6 h del nocturno cuentan primero en la semana nueva; con 40 h más, 6 h pasan a ser extra.
    expect(r.overtimeMinutes).toBe(6 * 60);
  });

  it('semana laboral que empieza el domingo cambia el resultado', () => {
    const emp = employer('a', 1000, { workweekStartDay: 0 });
    // sáb 24 oct: 10 h; dom 25: 10 h; lun 26–jue 29: 10 h c/u
    const shifts = [24, 25, 26, 27, 28, 29].map((d) => shift('a', at(2026, 10, d, 7), at(2026, 10, d, 17)));
    const r = summarizePeriod({ shifts, employers: [emp], range: { from: at(2026, 10, 25), to: at(2026, 11, 1) }, now: 0 });
    // Semana dom 25 – sáb 31: 50 h → 10 h extra
    expect(r.regularMinutes).toBe(40 * 60);
    expect(r.overtimeMinutes).toBe(10 * 60);
  });
});

describe('summarizePeriod: varios empleadores', () => {
  it('el overtime se calcula por separado en cada empleador', () => {
    // 30 h en A + 25 h en B = 55 h en total, pero ninguno pasa de 40 → sin overtime.
    const a = Array.from({ length: 5 }, (_, i) => shift('A', at(2026, 10, 19 + i, 8), at(2026, 10, 19 + i, 14)));
    const b = Array.from({ length: 5 }, (_, i) => shift('B', at(2026, 10, 19 + i, 16), at(2026, 10, 19 + i, 21)));
    const r = summarizePeriod({ shifts: [...a, ...b], employers: [employer('A', 1500), employer('B', 2000)], range: WEEK, now: 0 });
    expect(r.workedMinutes).toBe(55 * 60);
    expect(r.overtimeMinutes).toBe(0);
    expect(r.grossCents).toBe(30 * 1500 + 25 * 2000);
    expect(r.byEmployer).toHaveLength(2);
  });

  it('cada empleador usa su propia tarifa y multiplicador', () => {
    const a = fiveNineHourDays('A');
    const b = [shift('B', at(2026, 10, 24, 10), at(2026, 10, 24, 14))];
    const empB = employer('B', 2000, { overtime: { enabled: true, weeklyThresholdHours: 40, multiplier: 2 } });
    const r = summarizePeriod({ shifts: [...a, ...b], employers: [employer('A', 1600), empB], range: WEEK, now: 0 });
    const tA = r.byEmployer.find((t) => t.employerId === 'A')!;
    const tB = r.byEmployer.find((t) => t.employerId === 'B')!;
    expect(tA.overtimeMinutes).toBe(300);
    expect(tB.overtimeMinutes).toBe(0);
    expect(tB.basePayCents).toBe(4 * 2000);
  });
});

describe('summarizePeriod: propinas y turnos en curso', () => {
  it('suma propinas en efectivo y tarjeta al bruto', () => {
    const s = shift('a', at(2026, 10, 20, 17), at(2026, 10, 20, 23), { cashTipsCents: 4500, cardTipsCents: 8250 });
    const r = summarizePeriod({ shifts: [s], employers: [employer('a', 1200)], range: WEEK, now: 0 });
    expect(r.cashTipsCents).toBe(4500);
    expect(r.cardTipsCents).toBe(8250);
    expect(r.tipsCents).toBe(12750);
    expect(r.grossCents).toBe(6 * 1200 + 12750);
  });

  it('un turno en curso cuenta hasta ahora y se marca como activo', () => {
    const s = shift('a', at(2026, 10, 20, 9), null);
    const r = summarizePeriod({ shifts: [s], employers: [employer('a', 1200)], range: WEEK, now: at(2026, 10, 20, 12, 30) });
    expect(r.workedMinutes).toBe(210);
    expect(r.byShift.get(s.id)!.isActive).toBe(true);
  });

  it('un turno pertenece a la semana en la que empieza', () => {
    const s = shift('a', at(2026, 10, 25, 22), at(2026, 10, 26, 4));
    const r = summarizePeriod({ shifts: [s], employers: [employer('a', 1000)], range: WEEK, now: 0 });
    expect(r.shiftCount).toBe(1);
    expect(r.workedMinutes).toBe(6 * 60);
  });

  it('periodo vacío da ceros', () => {
    const r = summarizePeriod({ shifts: [], employers: [], range: WEEK, now: 0 });
    expect(r.grossCents).toBe(0);
    expect(r.byEmployer).toEqual([]);
  });
});
