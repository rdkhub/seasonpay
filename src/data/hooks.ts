import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { listEmployers } from './repos/employers';
import { listRules } from './repos/rules';
import { activeShift, shiftsInRange } from './repos/shifts';

/**
 * Lecturas reactivas: la UI se actualiza sola cuando cambia IndexedDB
 * (incluso si el cambio viene de otra pestaña o de la sincronización).
 * `undefined` = todavía cargando.
 */

export function useProfile() {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function useEmployers(includeArchived = false) {
  return useLiveQuery(() => listEmployers({ includeArchived }), [includeArchived]);
}

export function useShiftsInRange(from: number, to: number) {
  return useLiveQuery(() => shiftsInRange(from, to), [from, to]);
}

export function useActiveShift() {
  return useLiveQuery(async () => (await activeShift()) ?? null, []);
}

export function useRules() {
  return useLiveQuery(() => listRules(), []);
}

export function usePendingSyncCount() {
  return useLiveQuery(() => db.outbox.count(), []);
}
