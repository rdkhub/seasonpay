import { allocateOvertime } from './overtime';
import { workedMinutes } from './shifts';
import type { Cents, EmployerPayConfig, EmployerTotals, EpochMs, PeriodSummary, ShiftBreakdown, ShiftInput } from './types';

/** Pago por minutos a una tarifa por hora, redondeado al centavo. */
export function payForMinutes(minutes: number, hourlyRateCents: Cents, multiplier = 1): Cents {
  return Math.round((minutes * hourlyRateCents * multiplier) / 60);
}

export interface SummarizeInput {
  /**
   * Turnos del periodo y de las semanas vecinas. Para que el overtime salga bien,
   * pasa al menos 7 días antes y después del rango (una semana laboral puede no
   * coincidir con la semana que se muestra).
   */
  shifts: ShiftInput[];
  employers: EmployerPayConfig[];
  range: { from: EpochMs; to: EpochMs };
  now: EpochMs;
}

/**
 * Resumen de un periodo: horas normales y extra, propinas y pago bruto estimado.
 * Un turno pertenece al periodo en el que empieza.
 * Es una estimación: no descuenta impuestos ni deducciones, y usa la tarifa base
 * como "regular rate" (no incluye bonos ni otros pagos que el empleador pueda sumar).
 */
export function summarizePeriod({ shifts, employers, range, now }: SummarizeInput): PeriodSummary {
  const cfgMap = new Map(employers.map((e) => [e.id, e]));
  const alloc = allocateOvertime(shifts, cfgMap, now);

  const inRange = shifts.filter((s) => s.start >= range.from && s.start < range.to);
  const byShift = new Map<string, ShiftBreakdown>();
  const totals = new Map<string, EmployerTotals>();

  for (const s of inRange) {
    const cfg = cfgMap.get(s.employerId);
    const a = alloc.get(s.id) ?? { regularMinutes: 0, overtimeMinutes: 0, doubleTimeMinutes: 0 };
    const rate = cfg?.hourlyRateCents ?? 0;
    const mult = cfg?.overtime.enabled ? cfg.overtime.multiplier : 1;
    const dtMult = cfg?.overtime.enabled ? (cfg.overtime.doubleTimeMultiplier ?? mult) : 1;
    const tips = s.cashTipsCents + s.cardTipsCents;

    byShift.set(s.id, {
      shiftId: s.id,
      employerId: s.employerId,
      workedMinutes: workedMinutes(s, now),
      regularMinutes: a.regularMinutes,
      overtimeMinutes: a.overtimeMinutes,
      doubleTimeMinutes: a.doubleTimeMinutes,
      basePayCents: payForMinutes(a.regularMinutes, rate),
      overtimePayCents: payForMinutes(a.overtimeMinutes, rate, mult),
      doubleTimePayCents: payForMinutes(a.doubleTimeMinutes, rate, dtMult),
      tipsCents: tips,
      isActive: s.end === null,
    });

    const t = totals.get(s.employerId) ?? {
      employerId: s.employerId,
      regularMinutes: 0,
      overtimeMinutes: 0,
      doubleTimeMinutes: 0,
      basePayCents: 0,
      overtimePayCents: 0,
      doubleTimePayCents: 0,
      cashTipsCents: 0,
      cardTipsCents: 0,
      grossCents: 0,
    };
    t.regularMinutes += a.regularMinutes;
    t.overtimeMinutes += a.overtimeMinutes;
    t.doubleTimeMinutes += a.doubleTimeMinutes;
    t.cashTipsCents += s.cashTipsCents;
    t.cardTipsCents += s.cardTipsCents;
    totals.set(s.employerId, t);
  }

  // El pago se calcula sobre los minutos sumados por empleador para no arrastrar redondeos por turno.
  for (const t of totals.values()) {
    const cfg = cfgMap.get(t.employerId);
    const rate = cfg?.hourlyRateCents ?? 0;
    const mult = cfg?.overtime.enabled ? cfg.overtime.multiplier : 1;
    t.basePayCents = payForMinutes(t.regularMinutes, rate);
    t.overtimePayCents = payForMinutes(t.overtimeMinutes, rate, mult);
    t.doubleTimePayCents = payForMinutes(t.doubleTimeMinutes, rate, cfg?.overtime.enabled ? (cfg.overtime.doubleTimeMultiplier ?? mult) : 1);
    t.grossCents = t.basePayCents + t.overtimePayCents + t.doubleTimePayCents + t.cashTipsCents + t.cardTipsCents;
  }

  const byEmployer = [...totals.values()];
  const sum = (f: (t: EmployerTotals) => number) => byEmployer.reduce((acc, t) => acc + f(t), 0);
  const cash = sum((t) => t.cashTipsCents);
  const card = sum((t) => t.cardTipsCents);
  const regular = sum((t) => t.regularMinutes);
  const overtime = sum((t) => t.overtimeMinutes);
  const doubleTime = sum((t) => t.doubleTimeMinutes);

  return {
    shiftCount: inRange.length,
    workedMinutes: regular + overtime + doubleTime,
    regularMinutes: regular,
    overtimeMinutes: overtime,
    doubleTimeMinutes: doubleTime,
    basePayCents: sum((t) => t.basePayCents),
    overtimePayCents: sum((t) => t.overtimePayCents),
    doubleTimePayCents: sum((t) => t.doubleTimePayCents),
    cashTipsCents: cash,
    cardTipsCents: card,
    tipsCents: cash + card,
    grossCents: sum((t) => t.grossCents),
    byEmployer,
    byShift,
  };
}
