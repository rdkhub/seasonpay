// Vercel Function: tipo de cambio oficial USD → moneda local para una fecha (Argentina, Brasil, Colombia).
// Perú va por /api/fx (BCRP / SUNAT). Chile y Bolivia no tienen API pública sin registro: en la app se escriben a mano.
// Las fuentes están documentadas en tax_rules (fx_usd_local) y en docs/fuentes-oficiales.md.
//
// GET /api/fx-local?cur=ARS&date=2026-10-30
// → { date: "2026-10-30", value: 1534, currency: "ARS", provider: "bcra", series: "...", source: "https://api.bcra.gob.ar/..." }
//
// Si la fecha cae fin de semana o feriado, se devuelve el último valor publicado hasta 6 días antes.

const UA = { 'user-agent': 'SeasonPay/1.0 (+https://seasonpay.vercel.app)', accept: 'application/json' };

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const shift = (s, days) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** "2026-10-30" → "10-30-2026" (formato del PTAX) */
const mdy = (s) => `${s.slice(5, 7)}-${s.slice(8, 10)}-${s.slice(0, 4)}`;

/** Último valor en o antes de `date` dentro de una lista {date, value}. */
export function pickLatest(rows, date) {
  let best = null;
  for (const r of rows) {
    if (!r || !isDate(r.date) || r.date > date || !(r.value > 0)) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best;
}

/** BCRA, Estadísticas Cambiarias v1.0 (cotización del dólar por fecha). */
export function parseBcra(json) {
  const out = [];
  for (const r of Array.isArray(json?.results) ? json.results : []) {
    const det = Array.isArray(r?.detalle) ? r.detalle.find((d) => d?.codigoMoneda === 'USD') : null;
    const v = Number(det?.tipoCotizacion);
    if (isDate(String(r?.fecha)) && v > 0) out.push({ date: r.fecha, value: v });
  }
  return out;
}

/** Banco Central do Brasil, PTAX (cotização de venda). dataHoraCotacao: "2026-10-29 13:11:53.555" */
export function parsePtax(json) {
  const out = [];
  for (const r of Array.isArray(json?.value) ? json.value : []) {
    const d = String(r?.dataHoraCotacao ?? '').slice(0, 10);
    const v = Number(r?.cotacaoVenda);
    if (isDate(d) && v > 0) out.push({ date: d, value: v });
  }
  return out;
}

/** TRM (Superintendencia Financiera de Colombia, datos.gov.co). vigenciadesde: "2026-10-30T00:00:00.000" */
export function parseTrm(json, date) {
  const out = [];
  for (const r of Array.isArray(json) ? json : []) {
    const from = String(r?.vigenciadesde ?? '').slice(0, 10);
    const to = String(r?.vigenciahasta ?? '').slice(0, 10);
    const v = Number(r?.valor);
    if (!isDate(from) || !(v > 0)) continue;
    // La TRM rige un rango (ej. viernes a lunes): si la fecha cae dentro, vale para esa fecha.
    if (isDate(to) && from <= date && date <= to) out.push({ date, value: v, published: from });
    else out.push({ date: from, value: v });
  }
  return out;
}

/** Rango de control para no devolver basura si una fuente cambia de formato. */
const RANGE = { ARS: [10, 100000], BRL: [1, 50], COP: [100, 100000] };

export const SOURCES = {
  ARS: {
    provider: 'bcra',
    series: 'BCRA · Cotización USD (Estadísticas Cambiarias)',
    url: (from, to) => `https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD?fechadesde=${from}&fechahasta=${to}`,
    parse: (json) => parseBcra(json),
  },
  BRL: {
    provider: 'ptax',
    series: 'Banco Central do Brasil · PTAX venda',
    url: (from, to) =>
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${mdy(from)}'&@dataFinalCotacao='${mdy(to)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`,
    parse: (json) => parsePtax(json),
  },
  COP: {
    provider: 'trm',
    series: 'TRM · Superintendencia Financiera de Colombia',
    url: (from, to) =>
      `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=${encodeURIComponent(`vigenciadesde <= '${to}T00:00:00.000' AND vigenciahasta >= '${from}T00:00:00.000'`)}&$order=vigenciadesde%20DESC&$limit=20`,
    parse: (json, date) => parseTrm(json, date),
  },
};

export async function GET(request) {
  const url = new URL(request.url);
  const cur = (url.searchParams.get('cur') ?? '').toUpperCase();
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const src = SOURCES[cur];
  if (!src || !isDate(date)) return Response.json({ error: 'bad_request' }, { status: 400 });
  const from = shift(date, -6);
  const source = src.url(from, date);
  try {
    const r = await fetch(source, { headers: UA });
    if (!r.ok) return Response.json({ error: 'upstream', status: r.status }, { status: 502 });
    const json = await r.json();
    const best = pickLatest(src.parse(json, date), date);
    const [min, max] = RANGE[cur];
    if (!best || best.value < min || best.value > max) return Response.json({ error: 'no_data' }, { status: 404 });
    return Response.json(
      { date: best.date, value: best.value, currency: cur, provider: src.provider, series: src.series, source },
      { headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (e) {
    return Response.json({ error: 'upstream', detail: String(e?.cause?.code ?? e?.message ?? e) }, { status: 502 });
  }
}
