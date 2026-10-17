import { db } from '../db';
import { ensureRulesSeeded } from './rules';
import { signOutAndDeleteRemote } from '../sync/syncEngine';

/**
 * Borra todos los datos del usuario en este celular.
 * Si hay sesión de Supabase (Fase 4), también pide borrar la cuenta en el servidor.
 * Las reglas oficiales (tax_rules) no son datos personales: se vuelven a cargar.
 */
export async function deleteAllMyData(): Promise<void> {
  await signOutAndDeleteRemote();
  await db.transaction('rw', [db.profile, db.employers, db.shifts, db.paystubs, db.outbox, db.meta, db.taxRules], async () => {
    await Promise.all([db.profile.clear(), db.employers.clear(), db.shifts.clear(), db.paystubs.clear(), db.outbox.clear(), db.meta.clear(), db.taxRules.clear()]);
  });
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('seasonpay.')) localStorage.removeItem(k);
  } catch {
    /* almacenamiento bloqueado: no hay nada que limpiar */
  }
  await ensureRulesSeeded();
}
