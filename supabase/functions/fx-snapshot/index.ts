// Edge Function: guarda el tipo de cambio del día en public.fx_daily.
// La llama pg_cron (migración 0910) con el header x-cron-secret (secreto en Vault).
// Fuente: archivo público de SUNAT "fecha|compra|venta". No toca el API del BCRP
// (responde con una página anti-bots a consultas automáticas).
// Deploy: supabase functions deploy fx-snapshot --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUNAT_URL = 'https://www.sunat.gob.pe/a/txt/tipoCambio.txt';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function parseSunat(text: string) {
  const m = /^\s*(\d{2})\/(\d{2})\/(\d{4})\|(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)\|?\s*$/.exec(text);
  if (!m) return null;
  const buy = Number(m[4]);
  const sell = Number(m[5]);
  if (!(buy > 0) || !(sell > 0)) return null;
  return { date: `${m[3]}-${m[2]}-${m[1]}`, buy, sell };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: expected } = await admin.rpc('internal_get_secret', { p_name: 'cron_secret' });
  const got = req.headers.get('x-cron-secret');
  if (!expected || !got || got !== expected) return json({ error: 'unauthorized' }, 401);

  const r = await fetch(SUNAT_URL, { headers: { 'user-agent': 'SeasonPay/1.0 (+https://seasonpay.vercel.app)' } });
  const text = await r.text();
  const q = r.ok ? parseSunat(text) : null;
  if (!q) return json({ ok: false, status: r.status, detail: text.slice(0, 120) }, 502);

  const { error } = await admin.from('fx_daily').upsert(
    { date: q.date, provider: 'sunat', buy: q.buy, sell: q.sell, source_url: SUNAT_URL, fetched_at: new Date().toISOString() },
    { onConflict: 'date,provider' },
  );
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, ...q });
});
