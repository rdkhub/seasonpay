import type { Cents } from './types';
import type { HomeCurrency } from './currency';

/**
 * Ahorro en dólares con su equivalente en la moneda del país del usuario.
 * Regla del proyecto: cada movimiento guarda el tipo de cambio oficial que se usó ese día
 * (y en qué moneda). Nunca se recalcula con el tipo de cambio de hoy.
 */

export type SavingsKind = 'save' | 'withdraw';

export interface SavingsEntryInput {
  kind: SavingsKind;
  amountCents: Cents;
  /** Moneda local por dólar usado en ese movimiento; null si todavía no se pudo obtener */
  fxRate: number | null;
  /** Moneda del tipo de cambio guardado (los movimientos antiguos son PEN) */
  fxCurrency?: HomeCurrency;
}

export interface SavingsSummary {
  balanceCents: Cents;
  savedCents: Cents;
  withdrawnCents: Cents;
  /** Moneda del total local */
  currency: HomeCurrency;
  /** Saldo en centavos de la moneda local, sumando cada movimiento a su propio tipo de cambio */
  balanceLocalCents: number;
  /** Movimientos sin tipo de cambio (no entran al total local) */
  pendingRateCount: number;
  /** Movimientos guardados con otra moneda (no entran al total local) */
  otherCurrencyCount: number;
  /** Progreso hacia la meta, 0..1, o null si no hay meta */
  goalProgress: number | null;
}

/** USD (centavos) × tipo de cambio → centavos de la moneda local, redondeado. */
export function toLocalCents(usdCents: Cents, rate: number): number {
  return Math.round(usdCents * rate);
}

/** @deprecated usar toLocalCents (se deja por compatibilidad con el comparador de envíos a Perú). */
export const toPenCents = toLocalCents;

export function summarizeSavings(entries: SavingsEntryInput[], goalCents: Cents | null = null, currency: HomeCurrency = 'PEN'): SavingsSummary {
  let saved = 0;
  let withdrawn = 0;
  let local = 0;
  let pending = 0;
  let other = 0;
  for (const e of entries) {
    const sign = e.kind === 'save' ? 1 : -1;
    if (e.kind === 'save') saved += e.amountCents;
    else withdrawn += e.amountCents;
    if (currency === 'USD') continue;
    if ((e.fxCurrency ?? 'PEN') !== currency) other += 1;
    else if (e.fxRate === null || !(e.fxRate > 0)) pending += 1;
    else local += sign * toLocalCents(e.amountCents, e.fxRate);
  }
  const balance = saved - withdrawn;
  return {
    balanceCents: balance,
    savedCents: saved,
    withdrawnCents: withdrawn,
    currency,
    balanceLocalCents: currency === 'USD' ? balance : local,
    pendingRateCount: pending,
    otherCurrencyCount: other,
    goalProgress: goalCents && goalCents > 0 ? Math.max(0, Math.min(1, balance / goalCents)) : null,
  };
}
