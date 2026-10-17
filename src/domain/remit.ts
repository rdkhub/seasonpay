import type { Cents } from './types';

/**
 * Comparador de envíos EE. UU. → Perú.
 * Trabaja solo con cotizaciones que el usuario copió de la app de cada proveedor
 * (cuánto paga en total y cuánto le llega). No hay comisiones ni tipos de cambio
 * escritos en el código: el ranking sale de esos números y del tipo de cambio
 * interbancario del BCRP del día, que se usa como referencia.
 */

export type ReceiveCurrency = 'PEN' | 'USD';

export interface RemitQuoteInput {
  id: string;
  providerId: string;
  /** Lo que el usuario paga en total, comisión incluida, en centavos de dólar */
  totalPaidCents: Cents;
  /** Lo que recibe la otra persona, en centavos de la moneda de llegada */
  receivedCents: number;
  receiveCurrency: ReceiveCurrency;
}

export interface RemitQuoteResult extends RemitQuoteInput {
  /** Soles que llegan por cada dólar pagado (solo cuando llega en soles) */
  effectiveRate: number | null;
  /** Lo que llega expresado en céntimos de sol (con el tipo de referencia si llega en dólares) */
  receivedPenCents: number | null;
  /** Lo que se pierde frente al interbancario: céntimos de sol */
  lossPenCents: number | null;
  /** Lo mismo como fracción de lo pagado (0.03 = 3 %) */
  lossPct: number | null;
  rank: number | null;
}

export interface RemitComparison {
  results: RemitQuoteResult[];
  /** true cuando hay cotizaciones en soles y en dólares pero no hay tipo de referencia para compararlas */
  mixedWithoutReference: boolean;
}

export function validateQuote(q: Pick<RemitQuoteInput, 'totalPaidCents' | 'receivedCents'>): { totalPaid?: 'required'; received?: 'required' } {
  const e: { totalPaid?: 'required'; received?: 'required' } = {};
  if (!(q.totalPaidCents > 0)) e.totalPaid = 'required';
  if (!(q.receivedCents > 0)) e.received = 'required';
  return e;
}

/**
 * Ordena las cotizaciones de la que deja más plata a la que deja menos.
 * Con tipo de referencia: compara todo en soles. Sin referencia: solo puede comparar
 * cotizaciones de la misma moneda (por lo que llega por cada dólar pagado).
 */
export function compareQuotes(quotes: RemitQuoteInput[], referenceRate: number | null): RemitComparison {
  const ref = referenceRate && referenceRate > 0 ? referenceRate : null;
  const valid = quotes.filter((q) => q.totalPaidCents > 0 && q.receivedCents > 0);

  const results: RemitQuoteResult[] = valid.map((q) => {
    const effectiveRate = q.receiveCurrency === 'PEN' ? q.receivedCents / q.totalPaidCents : null;
    const receivedPenCents = q.receiveCurrency === 'PEN' ? q.receivedCents : ref ? Math.round(q.receivedCents * ref) : null;
    let lossPenCents: number | null = null;
    let lossPct: number | null = null;
    if (ref && receivedPenCents !== null) {
      const paidPen = q.totalPaidCents * ref;
      lossPenCents = Math.round(paidPen - receivedPenCents);
      lossPct = (paidPen - receivedPenCents) / paidPen;
    }
    return { ...q, effectiveRate, receivedPenCents, lossPenCents, lossPct, rank: null };
  });

  const currencies = new Set(results.map((r) => r.receiveCurrency));
  const mixedWithoutReference = !ref && currencies.size > 1;

  // Valor que llega por cada dólar pagado, en una unidad comparable.
  const score = (r: RemitQuoteResult): number => {
    if (ref) return r.receivedPenCents! / r.totalPaidCents;
    return r.receivedCents / r.totalPaidCents;
  };

  const rankGroup = (group: RemitQuoteResult[]) => {
    group.sort((a, b) => score(b) - score(a));
    group.forEach((r, i) => (r.rank = i + 1));
    return group;
  };

  if (!mixedWithoutReference) return { results: rankGroup(results), mixedWithoutReference };
  // Sin referencia y con dos monedas: cada moneda en su propio ranking.
  const pen = rankGroup(results.filter((r) => r.receiveCurrency === 'PEN'));
  const usd = rankGroup(results.filter((r) => r.receiveCurrency === 'USD'));
  return { results: [...pen, ...usd], mixedWithoutReference };
}
