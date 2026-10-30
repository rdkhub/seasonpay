import { db, type SavingsRow } from './db';
import { getRule } from './repos/rules';
import { updateSavings } from './repos/savings';
import { getSupabase } from './sync/supabaseClient';

/**
 * Tipo de cambio USD → PEN (venta).
 * 1) /api/fx (Vercel Function): BCRP interbancario venta; si el BCRP bloquea, SUNAT del día.
 * 2) Si no hay respuesta, el historial guardado en Supabase (fx_daily, lo llena fx-snapshot cada día).
 * La serie del BCRP sale de tax_rules (fx_usd_pen_series). Cada respuesta se guarda en meta.
 */

export type FxProvider = 'bcrp' | 'sunat';

export interface FxQuote {
  date: string;
  value: number;
  series: string;
  source: string;
  provider: FxProvider;
}

const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Último valor guardado en Supabase en o hasta 6 días antes de la fecha. */
async function fromHistory(date: string): Promise<FxQuote | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('fx_daily')
    .select('date, provider, sell, source_url')
    .lte('date', date)
    .gte('date', shiftDay(date, -6))
    .order('date', { ascending: false })
    .order('provider', { ascending: true })
    .limit(1);
  const row = data?.[0];
  if (error || !row) return null;
  return { date: String(row.date), value: Number(row.sell), series: row.provider === 'bcrp' ? 'BCRP' : 'SUNAT', source: row.source_url as string, provider: row.provider as FxProvider };
}

async function fxSeries(): Promise<string | null> {
  const rule = await getRule('fx_usd_pen_series', { state: 'PE' });
  const series = (rule?.value as { series?: string } | undefined)?.series;
  return rule?.jurisdiction === 'PE' && typeof series === 'string' ? series : null;
}

export async function fetchFx(date: string): Promise<FxQuote | null> {
  const cacheKey = `fx:${date}`;
  const cached = (await db.meta.get(cacheKey))?.value as FxQuote | undefined;
  // Respuestas guardadas antes de oct-2026 no tenían provider: eran del BCRP.
  if (cached) return { ...cached, provider: cached.provider ?? 'bcrp' };
  const series = await fxSeries();
  if (!series || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  try {
    let q: FxQuote | null = null;
    const r = await fetch(`/api/fx?date=${encodeURIComponent(date)}&series=${series}`).catch(() => null);
    if (r?.ok) {
      const body = (await r.json()) as Partial<FxQuote>;
      if (typeof body.value === 'number' && body.value > 0 && typeof body.date === 'string')
        q = { date: body.date, value: body.value, series: body.series ?? series, source: body.source ?? '', provider: body.provider === 'sunat' ? 'sunat' : 'bcrp' };
    }
    if (!q) q = await fromHistory(date);
    if (!q) return null;
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
    await updateSavings(row.id, { fxRate: q.value, fxDate: q.date, fxSource: q.provider });
    filled += 1;
  }
  return filled;
}
