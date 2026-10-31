// Edge Function: crea una cuenta con usuario y contraseña, sin correo.
// Supabase Auth necesita un correo, así que se usa uno interno `<usuario>@users.seasonpay.vercel.app`
// (mismo dominio que src/domain/username.ts). La cuenta nace confirmada, así que no se envía ningún correo.
// Después, la app entra con signInWithPassword.
// Límite: 5 cuentas por IP por hora. La IP se guarda solo como hash y se borra a las 24 h.
// Deploy: supabase functions deploy create-user --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const DOMAIN = 'users.seasonpay.vercel.app';
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;
const MAX_PER_HOUR = 5;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_username' }, 400);
  }
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (username.length < 3 || username.length > 20 || !USERNAME_RE.test(username) || /[._]{2}/.test(username)) {
    return json({ error: 'invalid_username' }, 400);
  }
  if (password.length < 8 || password.length > 72) return json({ error: 'weak_password' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Límite por IP (hash, nunca la IP en claro)
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256(`seasonpay-signup:${ip}`);
  await admin.from('signup_attempts').delete().lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  const { count } = await admin
    .from('signup_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= MAX_PER_HOUR) return json({ error: 'rate_limit' }, 429);
  await admin.from('signup_attempts').insert({ ip_hash: ipHash });

  const { error } = await admin.auth.admin.createUser({
    email: `${username}@${DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { username },
    app_metadata: { auth_kind: 'username' },
  });

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'email_exists' || code === 'user_already_exists' || /already/i.test(error.message)) {
      return json({ error: 'username_taken' }, 409);
    }
    if (code === 'weak_password') return json({ error: 'weak_password' }, 400);
    console.error('create-user', code, error.message);
    return json({ error: 'unknown' }, 500);
  }
  return json({ ok: true });
});
