import { db, type EventName } from './db';
import { getInstallId } from './install';
import { getSupabase } from './sync/supabaseClient';
import { APP_VERSION, detectPlatform } from '@/shared/lib/device';
import { isStandalone } from '@/shared/lib/installPrompt';

/**
 * Métricas del piloto, sin datos personales.
 * - Solo se guardan si el usuario aceptó la política y no apagó las métricas.
 * - props: solo valores categóricos cortos (pantalla, tipo). Nunca montos, nombres ni texto libre.
 * - Se encolan en el celular y se envían cuando hay señal (offline-first).
 */

type Props = Record<string, string | number | boolean>;

async function allowed(): Promise<boolean> {
  const p = await db.profile.get('me');
  return !!p?.consentAt && !p.analyticsOptOut;
}

export async function track(name: EventName, props: Props = {}): Promise<void> {
  try {
    if (!(await allowed())) return;
    await db.events.add({ name, props, clientAt: Date.now() });
  } catch {
    /* las métricas nunca rompen la app */
  }
}

/** "Uso semanal": un app_open por día como máximo. */
export async function trackAppOpen(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const last = (await db.meta.get('lastAppOpen'))?.value;
  if (last === today) return;
  await db.meta.put({ key: 'lastAppOpen', value: today });
  await track('app_open');
  // Primera vez que se abre desde la pantalla de inicio.
  if (isStandalone() && !(await db.meta.get('installTracked'))) {
    await db.meta.put({ key: 'installTracked', value: true });
    await track('install_completed');
  }
}

let flushing = false;
export async function flushTelemetry(): Promise<void> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const sb = await getSupabase();
  if (!sb) return;
  flushing = true;
  try {
    if (!(await allowed())) {
      await db.events.clear();
      return;
    }
    const installId = await getInstallId();
    const platform = detectPlatform();
    const standalone = isStandalone();
    for (;;) {
      const batch = await db.events.orderBy('clientAt').limit(100).toArray();
      if (batch.length === 0) break;
      const rows = batch.map((e) => ({
        install_id: installId,
        name: e.name,
        props: e.props,
        app_version: APP_VERSION,
        platform,
        standalone,
        client_at: new Date(e.clientAt).toISOString(),
      }));
      const { error } = await sb.from('events').insert(rows);
      if (error) throw error;
      await db.events.bulkDelete(batch.map((e) => e.seq!));
    }
  } catch (e) {
    console.warn('[telemetry]', e);
  } finally {
    flushing = false;
  }
}
