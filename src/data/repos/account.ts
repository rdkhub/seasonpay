import { db } from '../db';
import { ensureProvidersSeeded } from './remit';
import { ensureRulesSeeded } from './rules';
import { signOutAndDeleteRemote } from '../sync/syncEngine';
import { getInstallId, resetInstallIdCache } from '../install';
import { getSupabase } from '../sync/supabaseClient';
import { disableReminders } from '../push';

/**
 * Borra todos los datos del usuario en este celular.
 * Si hay sesión de Supabase (Fase 4), también pide borrar la cuenta en el servidor.
 * Las reglas oficiales (tax_rules) no son datos personales: se vuelven a cargar.
 */
export async function deleteAllMyData(): Promise<void> {
  // Feedback, encuesta, métricas y notificaciones de este celular (van por install_id, sin cuenta).
  await disableReminders().catch(() => undefined);
  const sb = await getSupabase();
  if (sb && (typeof navigator === 'undefined' || navigator.onLine)) {
    const { error } = await sb.rpc('delete_install_data', { p_install: await getInstallId() });
    if (error) console.warn('[delete] install data', error);
  }
  await signOutAndDeleteRemote();
  await db.transaction('rw', [db.profile, db.employers, db.shifts, db.paystubs, db.savings, db.remitQuotes, db.remitProviders, db.events, db.pending, db.outbox, db.meta, db.taxRules], async () => {
    await Promise.all([
      db.profile.clear(),
      db.employers.clear(),
      db.shifts.clear(),
      db.paystubs.clear(),
      db.savings.clear(),
      db.remitQuotes.clear(),
      db.remitProviders.clear(),
      db.events.clear(),
      db.pending.clear(),
      db.outbox.clear(),
      db.meta.clear(),
      db.taxRules.clear(),
    ]);
  });
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('seasonpay.')) localStorage.removeItem(k);
  } catch {
    /* almacenamiento bloqueado: no hay nada que limpiar */
  }
  resetInstallIdCache();
  await ensureRulesSeeded();
  await ensureProvidersSeeded();
}
