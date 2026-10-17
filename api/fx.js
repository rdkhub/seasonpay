// Vercel Function: tipo de cambio USD → PEN del BCRP para una fecha.
// El API del BCRP no permite llamadas desde el navegador (CORS), por eso pasa por aquí.
// La serie viene como parámetro (la app la toma de tax_rules: fx_usd_pen_series),
// pero solo se aceptan códigos de series diarias del BCRP.
//
// GET /api/fx?date=2026-10-17&series=PD04638PD
// → { date: "2026-10-15", value: 3.432, series: "PD04638PD", name: "...", source: "https://estadisticas.bcrp.gob.pe/..." }

const MONTHS = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

/** "15.Oct.26" → "2026-10-15". null si no se reconoce. */
export function parseBcrpDate(name) {
  const m = /^(\d{1,2})\.([A-Za-z]{3})\.(\d{2})$/.exec(String(name).trim());
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `20${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Último valor disponible en o antes de `date` (los fines de semana y feriados vienen como "n.d."). */
export function pickRate(json, date) {
  const periods = Array.isArray(json?.periods) ? json.periods : [];
  let best = null;
  for (const p of periods) {
    const d = parseBcrpDate(p?.name);
    const v = Number(Array.isArray(p?.values) ? p.values[0] : NaN);
    if (!d || !Number.isFinite(v) || v <= 0 || d > date) continue;
    if (!best || d > best.date) best = { date: d, value: v };
  }
  return best;
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const shift = (s, days) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function GET(request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const series = url.searchParams.get('series') ?? '';
  if (!isDate(date) || !/^PD\d{5}PD$/.test(series)) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  const from = shift(date, -12);
  const source = `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/${series}/json/${from}/${date}/esp`;
  try {
    const r = await fetch(source, { headers: { accept: 'application/json' } });
    if (!r.ok) return Response.json({ error: 'upstream', status: r.status }, { status: 502 });
    const json = await r.json();
    const best = pickRate(json, date);
    if (!best) return Response.json({ error: 'no_data' }, { status: 404 });
    return Response.json(
      { ...best, series, name: json?.config?.series?.[0]?.name ?? null, source },
      { headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch {
    return Response.json({ error: 'upstream' }, { status: 502 });
  }
}
