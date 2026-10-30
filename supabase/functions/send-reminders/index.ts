// Edge Function: recordatorios de fechas límite por Web Push.
// - La llama pg_cron una vez al día (migración 0820) con el header x-cron-secret.
//   El secreto vive en Supabase Vault ("cron_secret"); nadie lo escribe a mano.
// - La primera vez genera las llaves VAPID: la privada va a Vault y la pública a app_config,
//   de donde la lee la app para suscribirse.
// - Las fechas salen de tax_rules (form_1040nr_due_date). Si la regla no está, no manda nada.
// - Avisa 30, 7 y 1 día antes. Cada aviso se manda una sola vez por suscripción.
// Deploy: supabase functions deploy send-reminders --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SITE = 'https://seasonpay.vercel.app';
const DAYS_BEFORE = [30, 7, 1];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const pad = (n: number) => String(n).padStart(2, '0');
const daysUntil = (dateISO: string, todayISO: string) => {
  const a = Date.UTC(+todayISO.slice(0, 4), +todayISO.slice(5, 7) - 1, +todayISO.slice(8, 10));
  const b = Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
};

const text = {
  es: (days: number, date: string, year: number) => ({
    title: days === 1 ? 'Mañana vence tu declaración' : `Faltan ${days} días para declarar`,
    body: `Según el IRS, la fecha límite del Form 1040-NR (año ${year}) para quien cobró sueldo con retención es el ${date}. Revisa tu checklist en SeasonPay.`,
  }),
  en: (days: number, date: string, year: number) => ({
    title: days === 1 ? 'Your tax return is due tomorrow' : `${days} days left to file`,
    body: `Per the IRS, the Form 1040-NR deadline (tax year ${year}) for wage earners with withholding is ${date}. Check your SeasonPay checklist.`,
  }),
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: expected } = await admin.rpc('internal_get_secret', { p_name: 'cron_secret' });
  const got = req.headers.get('x-cron-secret');
  if (!expected || !got || got !== expected) return json({ error: 'unauthorized' }, 401);

  // Llaves VAPID: se crean una sola vez.
  let { data: privateKey } = await admin.rpc('internal_get_secret', { p_name: 'vapid_private_key' });
  let { data: publicKey } = await admin.rpc('internal_get_secret', { p_name: 'vapid_public_key' });
  if (!privateKey || !publicKey) {
    const keys = webpush.generateVAPIDKeys();
    await admin.rpc('internal_set_secret', { p_name: 'vapid_private_key', p_value: keys.privateKey });
    await admin.rpc('internal_set_secret', { p_name: 'vapid_public_key', p_value: keys.publicKey });
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
  }
  // La app lee la llave pública desde app_config.
  await admin.from('app_config').upsert({ key: 'vapid_public_key', value: publicKey, updated_at: new Date().toISOString() });
  webpush.setVapidDetails(SITE, publicKey as string, privateKey as string);

  const body = await req.json().catch(() => ({}));
  if (body?.action === 'init') return json({ ok: true, init: true });

  const today = (typeof body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10)) as string;
  const taxYear = Number(today.slice(0, 4)) - 1;

  const { data: rules } = await admin
    .from('tax_rules')
    .select('value, year')
    .eq('key', 'form_1040nr_due_date')
    .eq('jurisdiction', 'federal')
    .lte('year', taxYear)
    .order('year', { ascending: false })
    .limit(1);
  const r = rules?.[0]?.value?.employee_with_withholding as { month_after_tax_year?: number; day?: number } | undefined;
  if (!r?.month_after_tax_year || !r?.day) return json({ ok: true, sent: 0, reason: 'no_rule' });

  const due = `${taxYear + 1}-${pad(r.month_after_tax_year)}-${pad(r.day)}`;
  const days = daysUntil(due, today);
  if (!DAYS_BEFORE.includes(days)) return json({ ok: true, sent: 0, due, days });

  const reminderKey = `1040nr-${taxYear}-${days}`;
  const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth, lang').contains('topics', ['tax_deadlines']);
  const { data: already } = await admin.from('push_reminders_sent').select('endpoint').eq('reminder_key', reminderKey);
  const done = new Set((already ?? []).map((x) => x.endpoint));

  let sent = 0;
  let removed = 0;
  for (const s of subs ?? []) {
    if (done.has(s.endpoint)) continue;
    const lang = s.lang === 'en' ? 'en' : 'es';
    const dateLabel = new Date(`${due}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const msg = text[lang](days, dateLabel, taxYear);
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msg, url: '/season', tag: reminderKey }), { TTL: 86_400 });
      await admin.from('push_reminders_sent').insert({ endpoint: s.endpoint, reminder_key: reminderKey });
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404/410: la suscripción ya no existe (desinstaló o quitó el permiso).
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        removed += 1;
      } else console.warn('[push]', status, e);
    }
  }
  return json({ ok: true, due, days, sent, removed });
});
