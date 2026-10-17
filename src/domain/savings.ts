import type { Cents } from './types';

/**
 * Ahorro en dólares con su equivalente en soles.
 * Regla del proyecto: cada movimiento guarda el tipo de cambio que se usó ese día
 * (BCRP, interbancario venta). Nunca se recalcula con el tipo de cambio de hoy.
 */

export type SavingsKind = 'save' | 'withdraw';

export interface SavingsEntryInput {
  kind: SavingsKind;
  amountCents: Cents;
  /** Soles por dólar usado en ese movimiento; null si todavía no se pudo obtener */
  fxRate: number | null;
}

export interface SavingsSummary {
  balanceCents: Cents;
  savedCents: Cents;
  withdrawnCents: Cents;
  /** Saldo en céntimos de sol, sumando cada movimiento a su propio tipo de cambio */
  balancePenCents: number;
  /** Movimientos sin tipo de cambio (no entran al total en soles) */
  pendingRateCount: number;
  /** Progreso hacia la meta, 0..1, o null si no hay meta */
  goalProgress: number | null;
}

/** USD (centavos) × tipo de cambio → céntimos de sol, redondeado. */
export function toPenCents(usdCents: Cents, rate: number): number {
  return Math.round(usdCents * rate);
}

export function summarizeSavings(entries: SavingsEntryInput[], goalCents: Cents | null = null): SavingsSummary {
  let saved = 0;
  let withdrawn = 0;
  let pen = 0;
  let pending = 0;
  for (const e of entries) {
    const sign = e.kind === 'save' ? 1 : -1;
    if (e.kind === 'save') saved += e.amountCents;
    else withdrawn += e.amountCents;
    if (e.fxRate === null || !(e.fxRate > 0)) pending += 1;
    else pen += sign * toPenCents(e.amountCents, e.fxRate);
  }
  const balance = saved - withdrawn;
  return {
    balanceCents: balance,
    savedCents: saved,
    withdrawnCents: withdrawn,
    balancePenCents: pen,
    pendingRateCount: pending,
    goalProgress: goalCents && goalCents > 0 ? Math.max(0, Math.min(1, balance / goalCents)) : null,
  };
}
