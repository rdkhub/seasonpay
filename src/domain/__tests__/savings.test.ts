import { describe, expect, it } from 'vitest';
import { summarizeSavings, toPenCents } from '../savings';

describe('toPenCents', () => {
  it('convierte con el tipo de cambio guardado', () => {
    expect(toPenCents(10000, 3.438)).toBe(34380);
    expect(toPenCents(1, 3.4385)).toBe(3);
  });
});

describe('summarizeSavings', () => {
  it('usa el tipo de cambio de cada movimiento, no uno solo', () => {
    const s = summarizeSavings([
      { kind: 'save', amountCents: 50000, fxRate: 3.5 },
      { kind: 'save', amountCents: 50000, fxRate: 3.4 },
    ]);
    expect(s.balanceCents).toBe(100000);
    expect(s.balancePenCents).toBe(175000 + 170000);
  });

  it('resta los retiros', () => {
    const s = summarizeSavings([
      { kind: 'save', amountCents: 80000, fxRate: 3.45 },
      { kind: 'withdraw', amountCents: 20000, fxRate: 3.44 },
    ]);
    expect(s.balanceCents).toBe(60000);
    expect(s.withdrawnCents).toBe(20000);
    expect(s.balancePenCents).toBe(276000 - 68800);
  });

  it('cuenta los movimientos sin tipo de cambio', () => {
    const s = summarizeSavings([
      { kind: 'save', amountCents: 10000, fxRate: null },
      { kind: 'save', amountCents: 10000, fxRate: 3.4 },
    ]);
    expect(s.pendingRateCount).toBe(1);
    expect(s.balancePenCents).toBe(34000);
  });

  it('calcula el progreso hacia la meta (máximo 100%)', () => {
    expect(summarizeSavings([{ kind: 'save', amountCents: 25000, fxRate: 3.4 }], 100000).goalProgress).toBe(0.25);
    expect(summarizeSavings([{ kind: 'save', amountCents: 250000, fxRate: 3.4 }], 100000).goalProgress).toBe(1);
    expect(summarizeSavings([], null).goalProgress).toBeNull();
  });
});
