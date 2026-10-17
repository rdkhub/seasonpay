import { describe, expect, it } from 'vitest';
import { comparePaystub, periodRange, type PaystubInput } from '../paystubs';
import { at, employer, shift } from './fixtures';

const emp = employer('A', 1600);

/** Semana lun 19 – dom 25 oct 2026: cinco turnos de 9 h = 45 h (40 normales + 5 extra) */
const week = () => Array.from({ length: 5 }, (_, i) => shift('A', at(2026, 10, 19 + i, 8), at(2026, 10, 19 + i, 17), { cardTipsCents: 2000 }));

function stub(over: Partial<PaystubInput> = {}): PaystubInput {
  return {
    employerId: 'A',
    periodStart: '2026-10-19',
    periodEnd: '2026-10-25',
    regularMinutes: 40 * 60,
    overtimeMinutes: 5 * 60,
    grossCents: 40 * 1600 + 5 * 2400 + 10000,
    tipsCents: 10000,
    socialSecurityCents: 0,
    medicareCents: 0,
    ...over,
  };
}

describe('periodRange', () => {
  it('incluye el último día completo', () => {
    const r = periodRange('2026-10-19', '2026-10-25')!;
    expect(r.from).toBe(at(2026, 10, 19));
    expect(r.to).toBe(at(2026, 10, 26));
  });
  it('rechaza fin antes del inicio', () => {
    expect(periodRange('2026-10-25', '2026-10-19')).toBeNull();
  });
});

describe('comparePaystub', () => {
  it('boleta que coincide con los turnos no levanta alertas', () => {
    const c = comparePaystub(stub(), week(), emp, 0)!;
    expect(c.expectedRegularMinutes).toBe(2400);
    expect(c.expectedOvertimeMinutes).toBe(300);
    expect(c.expectedWagesCents).toBe(76000);
    expect(c.stubWagesCents).toBe(76000);
    expect(c.flags).toEqual([]);
  });

  it('detecta horas extra que no te pagaron', () => {
    const c = comparePaystub(stub({ regularMinutes: 2700, overtimeMinutes: 0, grossCents: 45 * 1600 + 10000 }), week(), emp, 0)!;
    expect(c.flags).toContain('overtime_missing');
    expect(c.flags).toContain('gross_low');
    expect(c.diffWagesCents).toBe(72000 - 76000);
  });

  it('detecta horas que faltan', () => {
    const c = comparePaystub(stub({ regularMinutes: 2400 - 120, overtimeMinutes: 300 }), week(), emp, 0)!;
    expect(c.flags).toContain('hours_missing');
  });

  it('tolera diferencias de redondeo chicas', () => {
    const c = comparePaystub(stub({ regularMinutes: 2400 - 10, grossCents: 76000 + 10000 - 50 }), week(), emp, 0)!;
    expect(c.flags).toEqual([]);
  });

  it('detecta propinas con tarjeta que no aparecen en la boleta', () => {
    const c = comparePaystub(stub({ tipsCents: 4000, grossCents: 76000 + 4000 }), week(), emp, 0)!;
    expect(c.expectedCardTipsCents).toBe(10000);
    expect(c.flags).toContain('card_tips_missing');
  });

  it('ignora turnos de otros empleadores', () => {
    const other = shift('B', at(2026, 10, 24, 8), at(2026, 10, 24, 18));
    const c = comparePaystub(stub(), [...week(), other], emp, 0)!;
    expect(c.shiftCount).toBe(5);
  });

  it('avisa si no hay turnos en el periodo', () => {
    const c = comparePaystub(stub(), [], emp, 0)!;
    expect(c.flags).toEqual(['no_shifts']);
  });

  it('suma Social Security y Medicare retenidos', () => {
    const c = comparePaystub(stub({ socialSecurityCents: 4712, medicareCents: 1102 }), week(), emp, 0)!;
    expect(c.ficaWithheldCents).toBe(5814);
  });
});
