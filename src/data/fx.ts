import { db, type SavingsRow } from './db';
import { getRule } from './repos/rules';
import { updateSavings } from './repos/savings';

/**
 * Tipo de cambio USD → PEN del BCRP. La serie sale de tax_rules (fx_usd_pen_series).
 * Se pide a /api/fx (Vercel Function) porque el API del BCRP no permite CORS.
 * Cada respuesta se guarda en meta para no volver a pedirla.
 */

export interface FxQuote {
  date: string;
  value: number;
  series: string;
  source: string;
}

async function fxSeries(): Promise<string | null> {
  const rule = await getRule('fx_usd_pen_series', { state: 'PE' });
  const series = (rule?.value as { series?: string } | undefined)?.series;
  return rule?.jurisdiction === 'PE' && typeof series === 'string' ? series : null;
}

export async function fetchFx(date: string): Promise<FxQuote | null> {
  const cacheKey = `fx:${date}`;
  const cached = (await db.meta.get(cacheKey))?.value as FxQuote | undefined;
  if (cached) return cached;
  const series = await fxSeries();
  if (!series || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  try {
    const r = await fetch(`/api/fx?date=${encodeURIComponent(date)}&series=${series}`);
    if (!r.ok) return null;
    const q = (await r.json()) as FxQuote;
    if (typeof q.value !== 'number' || !(q.value > 0)) return null;
    // El BCRP publica el interbancario con muchos decimales; guardamos 4 (igual que la columna en Supabase).
    q.value = Math.round(q.value * 10000) / 10000;
    await db.meta.put({ key: cacheKey, value: q });
    return q;
  } catch {
    return null;
  }
}

/** Completa el tipo de cambio de los movimientos que se guardaron sin señal. */
export async function fillPendingRates(rows: SavingsRow[]): Promise<number> {
  let filled = 0;
  for (const row of rows) {
    if (row.fxRate !== null) continue;
    const q = await fetchFx(row.date);
    if (!q) continue;
    await updateSavings(row.id, { fxRate: q.value, fxDate: q.date, fxSource: 'bcrp' });
    filled += 1;
  }
  return filled;
}
