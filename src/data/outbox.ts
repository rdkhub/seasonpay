import { db, type SyncTable } from './db';

/**
 * Cola de cambios pendientes de subir. Se llama dentro de la misma transacción
 * que la escritura, así nunca queda un cambio guardado sin su entrada en la cola.
 * Solo guardamos la referencia (tabla + id): al sincronizar se sube la versión
 * más reciente de la fila, incluida su lápida si fue borrada.
 */
export async function enqueue(table: SyncTable, rowId: string): Promise<void> {
  await db.outbox.add({ table, rowId, queuedAt: Date.now() });
}

export async function pendingCount(): Promise<number> {
  return db.outbox.count();
}
