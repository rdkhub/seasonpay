import { summarizePeriod } from './pay';
import { addDays, localDateTime } from './time';
import type { Cents, EmployerPayConfig, EpochMs, ShiftInput } from './types';

/**
 * Comparación de una boleta (paystub) con los turnos que el usuario registró.
 * Todo puro: recibe la boleta, los turnos y la configuración del empleador.
 */

export interface PaystubInput {
  employerId: string;
  /** yyyy-mm-dd, inclusive */
  periodStart: string;
  /** yyyy-mm-dd, inclusive */
  periodEnd: string;
  regularMinutes: number;
  overtimeMinutes: number;
  grossCents: Cents;
  /** Propinas que la boleta muestra como pagadas o reportadas */
  tipsCents: Cents;
  socialSecurityCents: Cents;
  medicareCents: Cents;
}

export type PaystubFlag =
  | 'hours_missing'
  | 'hours_extra'
  | 'overtime_missing'
  | 'overtime_extra'
  | 'gross_low'
  | 'gross_high'
  | 'card_tips_missing'
  | 'no_shifts';

export interface PaystubComparison {
  range: { from: EpochMs; to: EpochMs };
  shiftCount: number;
  expectedRegularMinutes: number;
  expectedOvertimeMinutes: number;
  /** Sueldo esperado (base + overtime), sin propinas */
  expectedWagesCents: Cents;
  /** Propinas con tarjeta que registraste (las que suelen pagarse en la boleta) */
  expectedCardTipsCents: Cents;
  /** Sueldo de la boleta sin propinas: bruto − propinas de la boleta */
  stubWagesCents: Cents;
  diffRegularMinutes: number;
  diffOvertimeMinutes: number;
  diffWagesCents: Cents;
  diffCardTipsCents: Cents;
  ficaWithheldCents: Cents;
  flags: PaystubFlag[];
}

/**
 * Márgenes para no alertar por redondeos del sistema de nómina.
 * Son tolerancias de la app, no reglas laborales ni tributarias.
 */
export const COMPARE_TOLERANCE = { minutes: 15, cents: 100 };

/** Rango [from, to) en epoch ms a partir de fechas inclusivas yyyy-mm-dd. */
export function periodRange(periodStart: string, periodEnd: string): { from: EpochMs; to: EpochMs } | null {
  const from = localDateTime(periodStart, '00:00');
  const endDay = localDateTime(periodEnd, '00:00');
  if (from === null || endDay === null || endDay < from) return null;
  return { from, to: addDays(endDay, 1) };
}

/**
 * @param shifts turnos del empleador del periodo y de las semanas vecinas
 *   (para repartir bien el overtime; se filtran por fecha de inicio dentro del periodo)
 */
export function comparePaystub(
  stub: PaystubInput,
  shifts: ShiftInput[],
  employer: EmployerPayConfig,
  now: EpochMs,
): PaystubComparison | null {
  const range = periodRange(stub.periodStart, stub.periodEnd);
  if (!range) return null;
  const own = shifts.filter((s) => s.employerId === stub.employerId);
  const summary = summarizePeriod({ shifts: own, employers: [employer], range, now });
  const t = summary.byEmployer[0];

  const expectedRegularMinutes = t?.regularMinutes ?? 0;
  // En la boleta las horas extra pueden venir juntas (overtime + doble tiempo): se comparan sumadas.
  const expectedOvertimeMinutes = (t?.overtimeMinutes ?? 0) + (t?.doubleTimeMinutes ?? 0);
  const expectedWagesCents = (t?.basePayCents ?? 0) + (t?.overtimePayCents ?? 0) + (t?.doubleTimePayCents ?? 0);
  const expectedCardTipsCents = t?.cardTipsCents ?? 0;
  const stubWagesCents = stub.grossCents - stub.tipsCents;

  const diffRegularMinutes = stub.regularMinutes - expectedRegularMinutes;
  const diffOvertimeMinutes = stub.overtimeMinutes - expectedOvertimeMinutes;
  const diffWagesCents = stubWagesCents - expectedWagesCents;
  const diffCardTipsCents = stub.tipsCents - expectedCardTipsCents;

  const { minutes: tm, cents: tc } = COMPARE_TOLERANCE;
  const flags: PaystubFlag[] = [];
  if (summary.shiftCount === 0) flags.push('no_shifts');
  else {
    const totalDiff = diffRegularMinutes + diffOvertimeMinutes;
    if (totalDiff < -tm) flags.push('hours_missing');
    if (totalDiff > tm) flags.push('hours_extra');
    if (diffOvertimeMinutes < -tm) flags.push('overtime_missing');
    if (diffOvertimeMinutes > tm) flags.push('overtime_extra');
    if (diffWagesCents < -tc) flags.push('gross_low');
    if (diffWagesCents > tc) flags.push('gross_high');
    if (diffCardTipsCents < -tc) flags.push('card_tips_missing');
  }

  return {
    range,
    shiftCount: summary.shiftCount,
    expectedRegularMinutes,
    expectedOvertimeMinutes,
    expectedWagesCents,
    expectedCardTipsCents,
    stubWagesCents,
    diffRegularMinutes,
    diffOvertimeMinutes,
    diffWagesCents,
    diffCardTipsCents,
    ficaWithheldCents: stub.socialSecurityCents + stub.medicareCents,
    flags,
  };
}

/** Flags que significan "te podrían estar pagando menos". */
export const UNDERPAY_FLAGS: PaystubFlag[] = ['hours_missing', 'overtime_missing', 'gross_low', 'card_tips_missing'];
