/**
 * Tipos del dominio. Todo en enteros: dinero en centavos, tiempo en minutos
 * o en milisegundos (epoch). Nada de floats para plata.
 */

export type Cents = number;
export type EpochMs = number;

export interface ShiftInput {
  id: string;
  employerId: string;
  start: EpochMs;
  /** null = turno en curso */
  end: EpochMs | null;
  breakMinutes: number;
  cashTipsCents: Cents;
  cardTipsCents: Cents;
}

/**
 * Regla de overtime de un empleador. Los valores por defecto NO viven aquí:
 * salen de la tabla tax_rules (ver src/data/seed/rules.json).
 */
export interface OvertimePolicy {
  enabled: boolean;
  weeklyThresholdHours: number;
  multiplier: number;
  /**
   * Overtime diario (Alaska, California, Colorado…): horas en un día por encima de este
   * umbral también son overtime. null = el estado no tiene overtime diario.
   */
  dailyThresholdHours?: number | null;
  /** Doble tiempo diario (California): horas por encima de este umbral en un día se pagan a doubleTimeMultiplier. */
  dailyDoubleTimeHours?: number | null;
  doubleTimeMultiplier?: number | null;
  /**
   * Séptimo día de trabajo seguido en la semana laboral:
   * - 'ca' (California): las primeras 8 h del 7.º día son overtime y lo que pasa de 8 h es doble tiempo.
   * - 'ky' (Kentucky): las horas del 7.º día son overtime si en la semana se trabajó más de seventhDayMinWeeklyHours.
   */
  seventhDay?: 'ca' | 'ky' | null;
  seventhDayMinWeeklyHours?: number | null;
}

export interface EmployerPayConfig {
  id: string;
  hourlyRateCents: Cents;
  /** 0 = domingo … 6 = sábado. Inicio de la semana laboral del empleador. */
  workweekStartDay: number;
  overtime: OvertimePolicy;
}

export interface ShiftBreakdown {
  shiftId: string;
  employerId: string;
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  /** Minutos a doble tiempo (solo California) */
  doubleTimeMinutes: number;
  basePayCents: Cents;
  overtimePayCents: Cents;
  doubleTimePayCents: Cents;
  tipsCents: Cents;
  isActive: boolean;
}

export interface EmployerTotals {
  employerId: string;
  regularMinutes: number;
  overtimeMinutes: number;
  doubleTimeMinutes: number;
  basePayCents: Cents;
  overtimePayCents: Cents;
  doubleTimePayCents: Cents;
  cashTipsCents: Cents;
  cardTipsCents: Cents;
  grossCents: Cents;
}

export interface PeriodSummary {
  shiftCount: number;
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  doubleTimeMinutes: number;
  basePayCents: Cents;
  overtimePayCents: Cents;
  doubleTimePayCents: Cents;
  cashTipsCents: Cents;
  cardTipsCents: Cents;
  tipsCents: Cents;
  /** Sueldo (base + overtime + doble tiempo) + propinas. Antes de impuestos y deducciones. */
  grossCents: Cents;
  byEmployer: EmployerTotals[];
  byShift: Map<string, ShiftBreakdown>;
}
