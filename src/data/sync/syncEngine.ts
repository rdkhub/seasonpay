import { db, type SyncTable } from '../db';
import {
  employerFromRemote,
  employerToRemote,
  paystubFromRemote,
  paystubToRemote,
  profileFromRemote,
  profileToRemote,
  PUSH_ORDER,
  shiftFromRemote,
  shiftToRemote,
} from './mapping';
import { getSupabase, hasSupabaseConfig, SYNC_ENABLED } from './supabaseClient';

/**
 * Motor de sincronización offline-first.
 *
 * PUSH: lee la cola (outbox), sube la versión actual de cada fila con upsert y,
 *   si todo salió bien, borra esas entradas de la cola.
 * PULL: baja lo que cambió en el servidor desde el último cursor (synced_at, que pone
 *   el servidor) y lo aplica si es más nuevo que lo local (updated_at).
 * CONFLICTOS: last-write-wins por updated_at. En el servidor, un trigger ignora un
 *   upsert cuyo updated_at sea más viejo que el guardado (ver migración 0001).
 *
 * Está apagado hasta la Fase 4 (VITE_SYNC_ENABLED=false o sin sesión).
 */

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error';

let status: SyncStatus = 'disabled';
const listeners = new Set<(s: SyncStatus) => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l(s));
};
export const getSyncStatus = () => status;
export function onSyncStatus(fn: (s: SyncStatus) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const BATCH = 500;

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
      if (p) payload = [profileToRemote(p, userId)];
    } else if (table === 'employers') {
      const rows = await db.employers.bulkGet(ids);
      payload = rows.filter((r) => !!r).map((r) => employerToRemote(r!, userId));
    } else if (table === 'shifts') {
      const rows = await db.shifts.bulkGet(ids);
      payload = rows.filter((r) => !!r).map((r) => shiftToRemote(r!, userId));
    } else {
      const rows = await db.paystubs.bulkGet(ids);
      payload = rows.filter((r) => !!r).map((r) => paystubToRemote(r!, userId));
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

    await db.transaction('rw', [db.profile, db.employers, db.shifts, db.paystubs, db.meta], async () => {
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
        } else {
          const remote = paystubFromRemote(r);
          const local = await db.paystubs.get(remote.id);
          if (!local || remote.updatedAt > local.updatedAt) await db.paystubs.put(remote);
        }
      }
      await db.meta.put({ key: cursorKey, value: data[data.length - 1]!.synced_at });
    });
  }
}

let running: Promise<void> | null = null;

export async function syncNow(): Promise<void> {
  if (!SYNC_ENABLED || !hasSupabaseConfig()) return setStatus('disabled');
  if (typeof navigator !== 'undefined' && !navigator.onLine) return setStatus('offline');
  if (running) return running;
  running = (async () => {
    try {
      const userId = await currentUserId();
      if (!userId) return setStatus('disabled');
      setStatus('syncing');
      await push(userId);
      await pull();
      setStatus('idle');
    } catch (e) {
      console.warn('[sync]', e);
      setStatus('error');
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Arranca la sincronización automática. Devuelve una función para detenerla. */
export function startAutoSync(intervalMs = 60_000): () => void {
  if (!SYNC_ENABLED || !hasSupabaseConfig()) {
    setStatus('disabled');
    return () => {};
  }
  const kick = () => void syncNow();
  const onVisible = () => document.visibilityState === 'visible' && kick();
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(kick, intervalMs);
  kick();
  return () => {
    window.removeEventListener('online', kick);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
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
