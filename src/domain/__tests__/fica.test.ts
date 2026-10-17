import { describe, expect, it } from 'vitest';
import { assessFica, type FicaRules } from '../fica';

/** Datos de prueba con la forma de las reglas de tax_rules (Pub 519). */
const rules: FicaRules = { studentYearsLimit: 5, teacherTraineePriorYearsLimit: 2, exemptVisaClasses: ['F', 'J', 'M', 'Q'] };

describe('assessFica', () => {
  it('J-1 estudiante en su primer año: podría estar exento', () => {
    const r = assessFica({ visaType: 'j1_student', priorYearsInStatus: 0, rules, withheldCents: 0 });
    expect(r.status).toBe('possibly_exempt');
    expect(r.yearInStatus).toBe(1);
    expect(r.showRefundFlow).toBe(false);
  });

  it('muestra el flujo de reembolso si le retuvieron', () => {
    const r = assessFica({ visaType: 'j1_student', priorYearsInStatus: 2, rules, withheldCents: 5814 });
    expect(r.status).toBe('possibly_exempt');
    expect(r.showRefundFlow).toBe(true);
  });

  it('J-1 estudiante en su sexto año: podría ser residente', () => {
    const r = assessFica({ visaType: 'j1_student', priorYearsInStatus: 5, rules, withheldCents: 5814 });
    expect(r.status).toBe('may_be_resident');
    expect(r.showRefundFlow).toBe(false);
  });

  it('J-1 trainee: usa el límite de años previos de profesor/trainee', () => {
    expect(assessFica({ visaType: 'j1_other', priorYearsInStatus: 1, rules, withheldCents: 0 }).status).toBe('possibly_exempt');
    expect(assessFica({ visaType: 'j1_other', priorYearsInStatus: 2, rules, withheldCents: 0 }).status).toBe('may_be_resident');
  });

  it('H-2B: la fuente no describe exención', () => {
    expect(assessFica({ visaType: 'h2b', priorYearsInStatus: 0, rules, withheldCents: 5000 }).status).toBe('no_exemption_found');
  });

  it('sin reglas cargadas no evalúa', () => {
    const r = assessFica({ visaType: 'j1_student', priorYearsInStatus: 0, rules: { ...rules, studentYearsLimit: null }, withheldCents: 0 });
    expect(r.status).toBe('unknown');
  });

  it('sin años no evalúa', () => {
    expect(assessFica({ visaType: 'j1_student', priorYearsInStatus: null, rules, withheldCents: 0 }).status).toBe('unknown');
  });
});
