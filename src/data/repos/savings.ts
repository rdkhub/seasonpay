import { newId } from '@/shared/lib/id';
import { db, type SavingsRow } from '../db';
import { enqueue } from '../outbox';

export type SavingsDraft = Omit<SavingsRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export async function listSavings(): Promise<SavingsRow[]> {
  const rows = await db.savings.toArray();
  return rows.filter((s) => s.deletedAt === null).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export async function createSavings(draft: SavingsDraft): Promise<SavingsRow> {
  return db.transaction('rw', db.savings, db.outbox, async () => {
    const now = Date.now();
    const row: SavingsRow = { ...draft, note: draft.note.trim(), id: newId(), createdAt: now, updatedAt: now, deletedAt: null };
    await db.savings.add(row);
    await enqueue('savings', row.id);
    return row;
  });
}

export async function updateSavings(id: string, patch: Partial<SavingsDraft>): Promise<void> {
  await db.transaction('rw', db.savings, db.outbox, async () => {
    const current = await db.savings.get(id);
    if (!current) return;
    await db.savings.put({ ...current, ...patch, updatedAt: Date.now() });
    await enqueue('savings', id);
  });
}

/** Borrado lógico (lápida) para que también se sincronice. */
export async function deleteSavings(id: string): Promise<void> {
  await db.transaction('rw', db.savings, db.outbox, async () => {
    const current = await db.savings.get(id);
    if (!current) return;
    await db.savings.put({ ...current, deletedAt: Date.now(), updatedAt: Date.now() });
    await enqueue('savings', id);
  });
}
