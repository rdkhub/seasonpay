/**
 * Evaluación informativa de Social Security y Medicare (FICA) para no residentes.
 *
 * La app NO decide si alguien está exento. Solo cruza los datos del perfil con las
 * reglas de tax_rules (Publication 519) y dice "según la fuente, podrías estar en este caso".
 * Ninguna cifra vive aquí: los límites de años llegan como parámetros.
 */

export type FicaVisa = 'j1_student' | 'j1_other' | 'h2b' | 'other';

export interface FicaRules {
  /** De tax_rules: exempt_individual_student (Pub 519). Límite de años calendario como estudiante. */
  studentYearsLimit: number | null;
  /** De tax_rules: exempt_individual_teacher_trainee. Años previos permitidos dentro de la ventana. */
  teacherTraineePriorYearsLimit: number | null;
  /** Visas F, J, M, Q cubiertas por la exención (fica_exemption_nonresident_fjmq). */
  exemptVisaClasses: string[];
}

export type FicaStatus =
  /** Según la fuente podrías estar exento: si te retuvieron, podrías pedir reembolso. */
  | 'possibly_exempt'
  /** Ya pasaste el límite de años: podrías ser residente fiscal y deber FICA. */
  | 'may_be_resident'
  /** La fuente no describe una exención para tu visa. */
  | 'no_exemption_found'
  /** Faltan datos (visa o años) o reglas para evaluar. */
  | 'unknown';

export interface FicaAssessmentInput {
  visaType: FicaVisa | null;
  /** Años calendario ANTERIORES al actual en que estuvo en EE. UU. con visa F, J, M o Q. */
  priorYearsInStatus: number | null;
  rules: FicaRules;
  /** Social Security + Medicare retenidos en las boletas registradas */
  withheldCents: number;
}

export interface FicaAssessment {
  status: FicaStatus;
  /** Año calendario actual en estatus (1 = primer año) */
  yearInStatus: number | null;
  withheldCents: number;
  /** true si conviene mostrar el flujo de reembolso */
  showRefundFlow: boolean;
}

const visaClass = (v: FicaVisa): string | null => (v === 'j1_student' || v === 'j1_other' ? 'J' : null);

export function assessFica({ visaType, priorYearsInStatus, rules, withheldCents }: FicaAssessmentInput): FicaAssessment {
  const base = { withheldCents, yearInStatus: priorYearsInStatus === null ? null : priorYearsInStatus + 1 };
  if (!visaType || visaType === 'other') return { ...base, status: 'unknown', showRefundFlow: false };

  const cls = visaClass(visaType);
  if (!cls || !rules.exemptVisaClasses.includes(cls)) {
    return { ...base, status: 'no_exemption_found', showRefundFlow: false };
  }
  if (priorYearsInStatus === null || priorYearsInStatus < 0) return { ...base, status: 'unknown', showRefundFlow: false };

  if (visaType === 'j1_student') {
    if (rules.studentYearsLimit === null) return { ...base, status: 'unknown', showRefundFlow: false };
    // Pub 519: deja de ser "exempt individual" si fue exento en más de N años calendario.
    const exempt = priorYearsInStatus < rules.studentYearsLimit;
    return { ...base, status: exempt ? 'possibly_exempt' : 'may_be_resident', showRefundFlow: exempt && withheldCents > 0 };
  }

  // j1_other: categoría de profesor o trainee (au pair, intern, trainee, camp counselor…)
  if (rules.teacherTraineePriorYearsLimit === null) return { ...base, status: 'unknown', showRefundFlow: false };
  const exempt = priorYearsInStatus < rules.teacherTraineePriorYearsLimit;
  return { ...base, status: exempt ? 'possibly_exempt' : 'may_be_resident', showRefundFlow: exempt && withheldCents > 0 };
}

/**
 * Alerta en una boleta: el usuario J-1 podría estar exento (no residente según Pub 519)
 * y la boleta muestra descuento de Social Security o Medicare.
 */
export function ficaAlertForPaystub(a: Pick<FicaAssessment, 'status'>, p: { socialSecurityCents: number; medicareCents: number }): boolean {
  return a.status === 'possibly_exempt' && p.socialSecurityCents + p.medicareCents > 0;
}
