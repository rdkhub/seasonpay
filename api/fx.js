// Vercel Function: tipo de cambio USD → PEN del BCRP para una fecha.
// El API del BCRP no permite llamadas desde el navegador (CORS), por eso pasa por aquí.
// La serie viene como parámetro (la app la toma de tax_rules: fx_usd_pen_series),
// pero solo se aceptan códigos de series diarias del BCRP.
//
// GET /api/fx?date=2026-10-17&series=PD04638PD
// → { date: "2026-10-15", value: 3.432, series: "PD04638PD", provider: "bcrp", name: "...", source: "https://estadisticas.bcrp.gob.pe/..." }
//
// Respaldo: desde oct-2026 el API del BCRP responde con una página anti-bots a las consultas
// automáticas. Si pasa eso, se usa el archivo público de SUNAT (fecha|compra|venta), que solo
// trae el día actual, y se devuelve el valor de venta con provider: "sunat". No se intenta
// saltar la protección del BCRP.

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

export const SUNAT_URL = 'https://www.sunat.gob.pe/a/txt/tipoCambio.txt';

/** "30/10/2026|3.455|3.461|" → { date: "2026-10-30", buy: 3.455, sell: 3.461 }. null si no se reconoce. */
export function parseSunat(text) {
  const m = /^\s*(\d{2})\/(\d{2})\/(\d{4})\|(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)\|?\s*$/.exec(String(text));
  if (!m) return null;
  const buy = Number(m[4]);
  const sell = Number(m[5]);
  if (!(buy > 0) || !(sell > 0)) return null;
  return { date: `${m[3]}-${m[2]}-${m[1]}`, buy, sell };
}

/** El valor de SUNAT sirve para la fecha pedida si es de ese día o de hasta 6 días antes (fines de semana y feriados). */
export function sunatFits(sunatDate, date) {
  if (sunatDate > date) return false;
  const diff = (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${sunatDate}T12:00:00Z`)) / 86_400_000;
  return diff <= 6;
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
  const cache = { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' };
  let bcrpError = null;
  try {
    const r = await fetch(source, {
      headers: { accept: 'application/json,text/plain,*/*', 'user-agent': 'SeasonPay/1.0 (+https://seasonpay.vercel.app)' },
    });
    const body = await r.text();
    if (!r.ok) bcrpError = `status_${r.status}`;
    else {
      let json = null;
      try {
        json = JSON.parse(body);
      } catch {
        bcrpError = 'not_json';
      }
      if (json) {
        const best = pickRate(json, date);
        if (best) return Response.json({ ...best, series, provider: 'bcrp', name: json?.config?.series?.[0]?.name ?? null, source }, { headers: cache });
        bcrpError = 'no_data';
      }
    }
  } catch (e) {
    bcrpError = String(e?.cause?.code ?? e?.message ?? e);
  }

  // Respaldo: SUNAT (solo trae el día actual).
  try {
    const r = await fetch(SUNAT_URL, { headers: { 'user-agent': 'SeasonPay/1.0 (+https://seasonpay.vercel.app)' } });
    const q = r.ok ? parseSunat(await r.text()) : null;
    if (q && sunatFits(q.date, date)) {
      return Response.json(
        { date: q.date, value: q.sell, buy: q.buy, series: 'SUNAT', provider: 'sunat', name: 'Tipo de cambio publicado por SUNAT (venta)', source: SUNAT_URL },
        { headers: cache },
      );
    }
    return Response.json({ error: 'no_data', bcrp: bcrpError, sunatDate: q?.date ?? null }, { status: 404 });
  } catch (e) {
    return Response.json({ error: 'upstream', bcrp: bcrpError, detail: String(e?.cause?.code ?? e?.message ?? e) }, { status: 502 });
  }
}
