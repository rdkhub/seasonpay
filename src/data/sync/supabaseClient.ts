import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SYNC_ENABLED = import.meta.env.VITE_SYNC_ENABLED === 'true';

/** Hay configuración de Supabase (no implica que haya sesión). */
export const hasSupabaseConfig = () => !!url && !!anonKey;

let client: Promise<SupabaseClient> | null = null;

/**
 * Cliente de Supabase o null si no hay variables de entorno (la app sigue funcionando local).
 * Se carga bajo demanda para no sumar peso a la primera carga.
 */
export function getSupabase(): Promise<SupabaseClient> | null {
  if (!hasSupabaseConfig()) return null;
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url!, anonKey!, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'seasonpay.auth' },
      }),
    );
  }
  return client;
}
