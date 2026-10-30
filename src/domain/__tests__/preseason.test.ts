import { describe, expect, it } from 'vitest';
import { assessFica, ficaAlertForPaystub, type FicaRules } from '../fica';
import { pickProviderLink, sortProvidersNeutral } from '../referrals';
import { daysUntil, federalDueDate, seasonDeadlines, seasonTaxYears, stateDueDate } from '../deadlines';

const rules: FicaRules = { studentYearsLimit: 5, teacherTraineePriorYearsLimit: 2, exemptVisaClasses: ['F', 'J', 'M', 'Q'] };
const stub = (ss: number, med: number) => ({ socialSecurityCents: ss, medicareCents: med });

describe('alerta FICA en la boleta', () => {
  it('J-1 no residente con descuento de Social Security: alerta', () => {
    const a = assessFica({ visaType: 'j1_student', priorYearsInStatus: 0, rules, withheldCents: 3100 });
    expect(ficaAlertForPaystub(a, stub(2480, 620))).toBe(true);
  });

  it('solo Medicare también alerta', () => {
    const a = assessFica({ visaType: 'j1_other', priorYearsInStatus: 0, rules, withheldCents: 620 });
    expect(ficaAlertForPaystub(a, stub(0, 620))).toBe(true);
  });

  it('boleta sin FICA: no alerta', () => {
    const a = assessFica({ visaType: 'j1_student', priorYearsInStatus: 0, rules, withheldCents: 0 });
    expect(ficaAlertForPaystub(a, stub(0, 0))).toBe(false);
  });

  it('J-1 que podría ser residente, H-2B o sin datos: no alerta', () => {
    const resident = assessFica({ visaType: 'j1_student', priorYearsInStatus: 5, rules, withheldCents: 3100 });
    const h2b = assessFica({ visaType: 'h2b', priorYearsInStatus: 0, rules, withheldCents: 3100 });
    const unknown = assessFica({ visaType: 'j1_student', priorYearsInStatus: null, rules, withheldCents: 3100 });
    for (const a of [resident, h2b, unknown]) expect(ficaAlertForPaystub(a, stub(2480, 620))).toBe(false);
  });
});

describe('interruptor de referidos', () => {
  const p = { url: 'https://wise.com/us/send-money/send-money-to-peru', referralUrl: 'https://wise.com/invite/abc', referralEnabled: true };

  it('apagado (por defecto): link normal aunque haya referido', () => {
    expect(pickProviderLink(p, false)).toEqual({ href: p.url, isReferral: false });
  });

  it('prendido y habilitado en el proveedor: link de referido marcado', () => {
    expect(pickProviderLink(p, true)).toEqual({ href: p.referralUrl, isReferral: true });
  });

  it('prendido pero el proveedor no lo habilitó o no tiene link: link normal', () => {
    expect(pickProviderLink({ ...p, referralEnabled: false }, true).isReferral).toBe(false);
    expect(pickProviderLink({ ...p, referralUrl: null }, true).isReferral).toBe(false);
    expect(pickProviderLink({ ...p, referralUrl: '  ' }, true).isReferral).toBe(false);
    expect(pickProviderLink({ ...p, referralUrl: 'http://inseguro.com' }, true).isReferral).toBe(false);
  });

  it('el orden es alfabético y no cambia con los referidos', () => {
    const list = [
      { name: 'Xoom', referralEnabled: true },
      { name: 'kambista', referralEnabled: false },
      { name: 'Wise', referralEnabled: true },
    ];
    expect(sortProvidersNeutral(list).map((x) => x.name)).toEqual(['kambista', 'Wise', 'Xoom']);
  });
});

describe('fechas límite de la temporada', () => {
  // Forma de las reglas de tax_rules (IRS y Montana DOR)
  const federal = { employee_with_withholding: { month_after_tax_year: 4, day: 15 } };
  const state = { calendar_year: '04-15' };

  it('1040-NR: día 15 del 4.º mes después del año tributario', () => {
    expect(federalDueDate(2025, federal)).toBe('2026-04-15');
    expect(federalDueDate(2026, federal)).toBe('2027-04-15');
    expect(federalDueDate(2026, null)).toBeNull();
  });

  it('Montana: fecha del año siguiente', () => {
    expect(stateDueDate(2026, state)).toBe('2027-04-15');
    expect(stateDueDate(2026, { calendar_year: 'abril' })).toBeNull();
  });

  it('una temporada de invierno cruza dos años tributarios', () => {
    const shifts = [Date.UTC(2026, 11, 20, 18), Date.UTC(2027, 0, 5, 18), Date.UTC(2027, 2, 28, 18)];
    const years = seasonTaxYears(shifts, Date.UTC(2027, 2, 30));
    expect(years).toEqual([2026, 2027]);
    expect(seasonDeadlines(years, { federal, state })).toEqual([
      { kind: 'federal', taxYear: 2026, date: '2027-04-15' },
      { kind: 'state', taxYear: 2026, date: '2027-04-15' },
      { kind: 'federal', taxYear: 2027, date: '2028-04-15' },
      { kind: 'state', taxYear: 2027, date: '2028-04-15' },
    ]);
  });

  it('sin regla estatal solo sale la federal', () => {
    expect(seasonDeadlines([2026], { federal })).toEqual([{ kind: 'federal', taxYear: 2026, date: '2027-04-15' }]);
  });

  it('daysUntil', () => {
    expect(daysUntil('2027-04-15', '2027-03-16')).toBe(30);
    expect(daysUntil('2027-04-15', '2027-04-16')).toBe(-1);
  });
});
