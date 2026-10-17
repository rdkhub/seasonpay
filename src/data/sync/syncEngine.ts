import { db, type SyncTable, type TaxRuleRow } from '../db';
import {
  employerFromRemote,
  employerToRemote,
  paystubFromRemote,
  paystubToRemote,
  profileFromRemote,
  profileToRemote,
  PUSH_ORDER,
  savingsFromRemote,
  savingsToRemote,
  shiftFromRemote,
  shiftToRemote,
} from './mapping';
import { getSupabase, hasSupabaseConfig, SYNC_ENABLED } from './supabaseClient';
import { providerFromRemote } from '../repos/remit';

/**
 * Motor de sincronización offline-first.
 *
 * PUSH: lee la cola (outbox), sube la versión actual de cada fila con upsert y,
 *   si todo salió bien, borra esas entradas de la cola.
 * PULL: baja lo que cambió en el servidor desde el último cursor (synced_at, que pone
 *   el servidor) y lo aplica si es más nuevo que lo local (updated_at).
 * CONFLICTOS: last-write-wins por updated_at. En el servidor, un trigger ignora un
 *   upsert cuyo updated_at sea más viejo que el guardado (migración 0100).
 * REGLAS: tax_rules es de lectura pública; se baja aunque no haya sesión, así una regla
 *   corregida en Supabase llega a todos sin publicar una versión nueva de la app.
 */

export type SyncStatus = 'disabled' | 'signed_out' | 'idle' | 'syncing' | 'offline' | 'error';

let status: SyncStatus = 'disabled';
let lastSyncedAt: number | null = null;
const listeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  if (s === 'idle') lastSyncedAt = Date.now();
  listeners.forEach((l) => l());
};
export interface SyncSnapshot {
  status: SyncStatus;
  lastSyncedAt: number | null;
}
let snapshot: SyncSnapshot = { status, lastSyncedAt };
listeners.add(() => (snapshot = { status, lastSyncedAt }));
export const getSyncSnapshot = () => snapshot;
export function onSyncChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const BATCH = 500;
const enabled = () => SYNC_ENABLED && hasSupabaseConfig();

async function currentUserId(): Promise<string | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

async function push(userId: string): Promise<void> {
  const sb = (await getSupabase())!;
  const items = await db.outbox.orderBy('seq').limit(BATCH).toArray();
  if (items.length === 0) return;
  const maxSeq = Math.max(...items.map((i) => i.seq ?? 0));

  const idsByTable = new Map<SyncTable, Set<string>>();
  for (const it of items) {
    const set = idsByTable.get(it.table) ?? new Set<string>();
    set.add(it.rowId);
    idsByTable.set(it.table, set);
  }

  for (const table of PUSH_ORDER) {
    const ids = [...(idsByTable.get(table) ?? [])];
    if (ids.length === 0) continue;
    let payload: Record<string, unknown>[] = [];
    if (table === 'profiles') {
      const p = await db.profile.get('me');
      if (p) payload = [profileToRemote({ ...p, checklistDone: p.checklistDone ?? [] }, userId)];
    } else if (table === 'employers') {
      const rows = await db.employers.bulkGet(ids);
      payload = rows.filter((r) => !!r).map((r) => employerToRemote(r!, userId));
    } else if (table === 'shifts') {
      const rows = await db.shifts.bulkGet(ids);
      payload = rows.filter((r) => !!r).map((r) => shiftToRemote(r!, userId));
    } else if (table === 'paystubs') {
      const rows = await db.paystubs.bulkGet(ids);
      payload = rows.filter((r) => !!r).map((r) => paystubToRemote(r!, userId));
    } else {
      const rows = await db.savings.bulkGet(ids);
      payload = rows.filter((r) => !!r).map((r) => savingsToRemote(r!, userId));
    }
    if (payload.length === 0) continue;
    const { error } = await sb.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }

  await db.outbox.where('seq').belowOrEqual(maxSeq).delete();
  if (items.length === BATCH) await push(userId);
}

async function pull(): Promise<void> {
  const sb = (await getSupabase())!;
  for (const table of PUSH_ORDER) {
    const cursorKey = `pull:${table}`;
    const cursor = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? '1970-01-01T00:00:00Z';
    const { data, error } = await sb.from(table).select('*').gt('synced_at', cursor).order('synced_at').limit(1000);
    if (error) throw error;
    if (!data || data.length === 0) continue;

    await db.transaction('rw', [db.profile, db.employers, db.shifts, db.paystubs, db.savings, db.meta], async () => {
      for (const r of data) {
        if (table === 'profiles') {
          const remote = profileFromRemote(r);
          const local = await db.profile.get('me');
          if (!local || remote.updatedAt > local.updatedAt) await db.profile.put(remote);
        } else if (table === 'employers') {
          const remote = employerFromRemote(r);
          const local = await db.employers.get(remote.id);
          if (!local || remote.updatedAt > local.updatedAt) await db.employers.put(remote);
        } else if (table === 'shifts') {
          const remote = shiftFromRemote(r);
          const local = await db.shifts.get(remote.id);
          if (!local || remote.updatedAt > local.updatedAt) await db.shifts.put(remote);
        } else if (table === 'paystubs') {
          const remote = paystubFromRemote(r);
          const local = await db.paystubs.get(remote.id);
          if (!local || remote.updatedAt > local.updatedAt) await db.paystubs.put(remote);
        } else {
          const remote = savingsFromRemote(r);
          const local = await db.savings.get(remote.id);
          if (!local || remote.updatedAt > local.updatedAt) await db.savings.put(remote);
        }
      }
      await db.meta.put({ key: cursorKey, value: data[data.length - 1]!.synced_at });
    });
    if (data.length === 1000) return pull();
  }
}

/** Baja las reglas oficiales actualizadas (no requiere sesión). */
async function pullRules(): Promise<void> {
  const sb = (await getSupabase())!;
  const cursorKey = 'pull:tax_rules';
  const cursor = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? '1970-01-01T00:00:00Z';
  const { data, error } = await sb.from('tax_rules').select('*').gt('synced_at', cursor).order('synced_at').limit(500);
  if (error) throw error;
  if (!data || data.length === 0) return;
  const rows: TaxRuleRow[] = data.map((r) => ({
    id: `${r.jurisdiction}:${r.key}:${r.year}`,
    key: r.key as string,
    jurisdiction: r.jurisdiction as string,
    year: r.year as number,
    value: r.value as Record<string, unknown>,
    sourceUrl: r.source_url as string,
    verifiedAt: String(r.verified_at),
    reviewedBy: (r.reviewed_by as string | null) ?? null,
  }));
  await db.transaction('rw', db.taxRules, db.meta, async () => {
    await db.taxRules.bulkPut(rows);
    await db.meta.put({ key: cursorKey, value: data[data.length - 1]!.synced_at });
  });
}

async function pullProviders(): Promise<void> {
  const sb = (await getSupabase())!;
  const cursorKey = 'pull:remit_providers';
  const cursor = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? '1970-01-01T00:00:00Z';
  const { data, error } = await sb.from('remit_providers').select('*').gt('synced_at', cursor).order('synced_at').limit(200);
  if (error) throw error;
  if (!data || data.length === 0) return;
  await db.transaction('rw', db.remitProviders, db.meta, async () => {
    await db.remitProviders.bulkPut(data.map((r) => providerFromRemote(r)));
    await db.meta.put({ key: cursorKey, value: data[data.length - 1]!.synced_at });
  });
}

let running: Promise<void> | null = null;
let again = false;

export async function syncNow(): Promise<void> {
  if (!enabled()) return setStatus('disabled');
  if (typeof navigator !== 'undefined' && !navigator.onLine) return setStatus('offline');
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      setStatus('syncing');
      await pullRules().catch((e) => console.warn('[sync] rules', e));
      await pullProviders().catch((e) => console.warn('[sync] providers', e));
      const userId = await currentUserId();
      if (!userId) return setStatus('signed_out');
      await push(userId);
      await pull();
      setStatus('idle');
    } catch (e) {
      console.warn('[sync]', e);
      setStatus('error');
    } finally {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    }
  })();
  return running;
}

let debounce: number | undefined;
/** Pide sincronizar unos segundos después de un cambio (agrupa varios cambios seguidos). */
export function requestSync(delayMs = 2500): void {
  if (!enabled() || typeof window === 'undefined') return;
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => void syncNow(), delayMs);
}

/** Arranca la sincronización automática. Devuelve una función para detenerla. */
export function startAutoSync(intervalMs = 60_000): () => void {
  if (!enabled()) {
    setStatus('disabled');
    return () => {};
  }
  const kick = () => void syncNow();
  const onVisible = () => document.visibilityState === 'visible' && kick();
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(kick, intervalMs);
  // Cada cambio local entra a la cola: sincronizamos poco después.
  const onQueued = () => requestSync();
  db.outbox.hook('creating', onQueued);
  kick();
  return () => {
    window.removeEventListener('online', kick);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
    db.outbox.hook('creating').unsubscribe(onQueued);
  };
}

/** Borra los datos personales de este celular (las reglas oficiales se quedan). */
export async function clearLocalPersonalData(): Promise<void> {
  await db.transaction('rw', [db.profile, db.employers, db.shifts, db.paystubs, db.savings, db.remitQuotes, db.outbox, db.meta], async () => {
    await Promise.all([db.profile.clear(), db.employers.clear(), db.shifts.clear(), db.paystubs.clear(), db.savings.clear(), db.remitQuotes.clear(), db.outbox.clear()]);
    // Cursores de datos personales; los de datos públicos (reglas, proveedores) se conservan.
    const keys = (await db.meta.toArray()).map((m) => m.key).filter((k) => k.startsWith('pull:') && k !== 'pull:tax_rules' && k !== 'pull:remit_providers');
    await db.meta.bulkDelete(keys);
  });
}

/**
 * Cerrar sesión: sube lo pendiente, cierra la sesión y limpia este celular para que
 * otra persona no vea tus datos. Todo queda respaldado en tu cuenta.
 */
export async function signOutAndClear(): Promise<'ok' | 'pending_offline'> {
  const sb = await getSupabase();
  if (!sb) return 'ok';
  if ((await db.outbox.count()) > 0) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'pending_offline';
    await syncNow();
    if ((await db.outbox.count()) > 0) return 'pending_offline';
  }
  await sb.auth.signOut();
  await clearLocalPersonalData();
  setStatus('signed_out');
  return 'ok';
}

/**
 * Si hay sesión, pide al servidor borrar la cuenta y todos sus datos (Edge Function
 * delete-account) y cierra sesión. Sin sesión no hace nada.
 */
export async function signOutAndDeleteRemote(): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  if (!data.session) return;
  const { error } = await sb.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await sb.auth.signOut();
}
