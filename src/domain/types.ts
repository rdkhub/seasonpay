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
  basePayCents: Cents;
  overtimePayCents: Cents;
  tipsCents: Cents;
  isActive: boolean;
}

export interface EmployerTotals {
  employerId: string;
  regularMinutes: number;
  overtimeMinutes: number;
  basePayCents: Cents;
  overtimePayCents: Cents;
  cashTipsCents: Cents;
  cardTipsCents: Cents;
  grossCents: Cents;
}

export interface PeriodSummary {
  shiftCount: number;
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  basePayCents: Cents;
  overtimePayCents: Cents;
  cashTipsCents: Cents;
  cardTipsCents: Cents;
  tipsCents: Cents;
  /** Sueldo (base + overtime) + propinas. Antes de impuestos y deducciones. */
  grossCents: Cents;
  byEmployer: EmployerTotals[];
  byShift: Map<string, ShiftBreakdown>;
}
