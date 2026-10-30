import { newId } from '@/shared/lib/id';
import { db, type ShiftRow } from '../db';
import { enqueue } from '../outbox';
import { track } from '../telemetry';

const DAY = 86_400_000;

export interface ShiftDraft {
  employerId: string;
  startedAt: number;
  endedAt: number | null;
  breakMinutes?: number;
  cashTipsCents?: number;
  cardTipsCents?: number;
  note?: string;
}

const alive = (s: ShiftRow) => s.deletedAt === null;

/** Turnos que empiezan entre from (incluido) y to (excluido). */
export async function shiftsInRange(from: number, to: number): Promise<ShiftRow[]> {
  const rows = await db.shifts.where('startedAt').between(from, to, true, false).toArray();
  return rows.filter(alive).sort((a, b) => a.startedAt - b.startedAt);
}

/** Turno en curso (sin hora de fin). Se busca en los últimos 2 días. */
export async function activeShift(now = Date.now()): Promise<ShiftRow | undefined> {
  const rows = await db.shifts.where('startedAt').above(now - 2 * DAY).toArray();
  return rows.filter((s) => alive(s) && s.endedAt === null).sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function createShift(draft: ShiftDraft): Promise<ShiftRow> {
  const row = await insertShift(draft);
  if (row.endedAt !== null) void track('shift_logged', { mode: 'manual' });
  return row;
}

async function insertShift(draft: ShiftDraft): Promise<ShiftRow> {
  return db.transaction('rw', db.shifts, db.outbox, async () => {
    const now = Date.now();
    const row: ShiftRow = {
      id: newId(),
      employerId: draft.employerId,
      startedAt: draft.startedAt,
      endedAt: draft.endedAt,
      breakMinutes: Math.max(0, Math.round(draft.breakMinutes ?? 0)),
      cashTipsCents: Math.max(0, Math.round(draft.cashTipsCents ?? 0)),
      cardTipsCents: Math.max(0, Math.round(draft.cardTipsCents ?? 0)),
      note: draft.note?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.shifts.add(row);
    await enqueue('shifts', row.id);
    return row;
  });
}

export async function updateShift(id: string, patch: Partial<Omit<ShiftRow, 'id' | 'createdAt'>>): Promise<void> {
  await db.transaction('rw', db.shifts, db.outbox, async () => {
    const current = await db.shifts.get(id);
    if (!current) return;
    await db.shifts.put({ ...current, ...patch, updatedAt: Date.now() });
    await enqueue('shifts', id);
  });
}

/** Iniciar turno con el cronómetro. Si ya hay uno en curso, lo devuelve sin crear otro. */
export async function startShift(employerId: string, at = Date.now()): Promise<ShiftRow> {
  const running = await activeShift(at);
  if (running) return running;
  return createShift({ employerId, startedAt: at, endedAt: null });
}

export async function stopShift(id: string, at = Date.now()): Promise<void> {
  const current = await db.shifts.get(id);
  if (!current) return;
  // Si se detiene en el mismo minuto, dejamos al menos 1 minuto para que el turno sea válido.
  await updateShift(id, { endedAt: Math.max(at, current.startedAt + 60_000) });
  void track('shift_logged', { mode: 'timer' });
}

/** Borrado lógico (lápida) para que el borrado también se sincronice. */
export async function deleteShift(id: string): Promise<void> {
  await updateShift(id, { deletedAt: Date.now() });
}
