import { describe, expect, it } from 'vitest';
import { compareQuotes, validateQuote, type RemitQuoteInput } from '../remit';

// Cifras de ejemplo inventadas para la prueba, no son tarifas reales.
const q = (id: string, paid: number, received: number, cur: 'PEN' | 'USD' = 'PEN'): RemitQuoteInput => ({
  id,
  providerId: id,
  totalPaidCents: paid,
  receivedCents: received,
  receiveCurrency: cur,
});

describe('compareQuotes', () => {
  it('ordena por lo que llega por dólar y calcula la pérdida frente al BCRP', () => {
    const { results, mixedWithoutReference } = compareQuotes([q('a', 50_000, 165_000), q('b', 50_000, 170_000)], 3.5);
    expect(mixedWithoutReference).toBe(false);
    expect(results.map((r) => r.id)).toEqual(['b', 'a']);
    const b = results[0]!;
    expect(b.rank).toBe(1);
    expect(b.effectiveRate).toBeCloseTo(3.4, 6);
    // 500 USD × 3.5 = S/ 1,750; llegan S/ 1,700 → pierde S/ 50 (2.857 %)
    expect(b.lossPenCents).toBe(5_000);
    expect(b.lossPct).toBeCloseTo(50 / 1750, 6);
  });

  it('compara una cotización en dólares usando el tipo de referencia', () => {
    const { results } = compareQuotes([q('pen', 50_000, 168_000), q('usd', 50_000, 49_000, 'USD')], 3.5);
    const usd = results.find((r) => r.id === 'usd')!;
    expect(usd.effectiveRate).toBeNull();
    expect(usd.receivedPenCents).toBe(171_500);
    expect(usd.lossPenCents).toBe(3_500);
    expect(results[0]!.id).toBe('usd');
  });

  it('sin tipo de referencia separa los rankings por moneda', () => {
    const { results, mixedWithoutReference } = compareQuotes([q('p1', 100, 340), q('u1', 100, 98, 'USD'), q('p2', 100, 345)], null);
    expect(mixedWithoutReference).toBe(true);
    expect(results.map((r) => [r.id, r.rank])).toEqual([
      ['p2', 1],
      ['p1', 2],
      ['u1', 1],
    ]);
    expect(results.every((r) => r.lossPenCents === null)).toBe(true);
  });

  it('ignora cotizaciones incompletas', () => {
    const { results } = compareQuotes([q('ok', 100, 340), q('bad', 0, 340), q('bad2', 100, 0)], 3.5);
    expect(results.map((r) => r.id)).toEqual(['ok']);
  });

  it('validateQuote pide ambos montos', () => {
    expect(validateQuote({ totalPaidCents: 0, receivedCents: 0 })).toEqual({ totalPaid: 'required', received: 'required' });
    expect(validateQuote({ totalPaidCents: 1, receivedCents: 1 })).toEqual({});
  });
});
