// Edge Function: borra la cuenta del usuario que llama y, por ON DELETE CASCADE,
// todos sus datos (profiles, employers, shifts). Se usa desde "Borrar todos mis datos"
// cuando hay sesión (Fase 4).
// Deploy: supabase functions deploy delete-account
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401, headers: cors });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return new Response('Unauthorized', { status: 401, headers: cors });

  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) return new Response(JSON.stringify({ error: delError.message }), { status: 500, headers: cors });

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
