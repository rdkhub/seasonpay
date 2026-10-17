import { newId } from '@/shared/lib/id';
import { db, type PaystubRow } from '../db';
import { enqueue } from '../outbox';

export type PaystubDraft = Omit<PaystubRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export async function listPaystubs(): Promise<PaystubRow[]> {
  const rows = await db.paystubs.toArray();
  return rows.filter((p) => p.deletedAt === null).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.createdAt - a.createdAt);
}

export async function createPaystub(draft: PaystubDraft): Promise<PaystubRow> {
  return db.transaction('rw', db.paystubs, db.outbox, async () => {
    const now = Date.now();
    const row: PaystubRow = { ...draft, note: draft.note.trim(), id: newId(), createdAt: now, updatedAt: now, deletedAt: null };
    await db.paystubs.add(row);
    await enqueue('paystubs', row.id);
    return row;
  });
}

export async function updatePaystub(id: string, patch: Partial<PaystubDraft>): Promise<void> {
  await db.transaction('rw', db.paystubs, db.outbox, async () => {
    const current = await db.paystubs.get(id);
    if (!current) return;
    await db.paystubs.put({ ...current, ...patch, updatedAt: Date.now() });
    await enqueue('paystubs', id);
  });
}

/** Borrado lógico (lápida) para que también se sincronice. */
export async function deletePaystub(id: string): Promise<void> {
  await db.transaction('rw', db.paystubs, db.outbox, async () => {
    const current = await db.paystubs.get(id);
    if (!current) return;
    await db.paystubs.put({ ...current, deletedAt: Date.now(), updatedAt: Date.now() });
    await enqueue('paystubs', id);
  });
}
