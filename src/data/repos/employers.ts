import { newId } from '@/shared/lib/id';
import { db, type EmployerRow, type PayFrequency } from '../db';
import { enqueue } from '../outbox';
import { overtimeDefaults } from './rules';

export interface EmployerDraft {
  name: string;
  hourlyRateCents: number;
  payFrequency: PayFrequency;
  workweekStartDay?: number;
  overtimeEnabled?: boolean;
  overtimeThresholdHours?: number;
  overtimeMultiplier?: number;
}

export async function listEmployers(opts: { includeArchived?: boolean } = {}): Promise<EmployerRow[]> {
  const rows = await db.employers.toArray();
  return rows
    .filter((e) => e.deletedAt === null && (opts.includeArchived || !e.archived))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createEmployer(draft: EmployerDraft, state: string | null): Promise<EmployerRow> {
  const ot = await overtimeDefaults(state);
  return db.transaction('rw', db.employers, db.outbox, async () => {
    const now = Date.now();
    const row: EmployerRow = {
      id: newId(),
      name: draft.name.trim(),
      hourlyRateCents: Math.max(0, Math.round(draft.hourlyRateCents)),
      payFrequency: draft.payFrequency,
      workweekStartDay: draft.workweekStartDay ?? 1,
      overtimeEnabled: draft.overtimeEnabled ?? ot.enabled,
      overtimeThresholdHours: draft.overtimeThresholdHours ?? ot.thresholdHours,
      overtimeMultiplier: draft.overtimeMultiplier ?? ot.multiplier,
      overtimeRuleKey: ot.ruleKey,
      archived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.employers.add(row);
    await enqueue('employers', row.id);
    return row;
  });
}

export async function updateEmployer(id: string, patch: Partial<Omit<EmployerRow, 'id' | 'createdAt'>>): Promise<void> {
  await db.transaction('rw', db.employers, db.outbox, async () => {
    const current = await db.employers.get(id);
    if (!current) return;
    await db.employers.put({ ...current, ...patch, name: (patch.name ?? current.name).trim(), updatedAt: Date.now() });
    await enqueue('employers', id);
  });
}

/** Archivar: deja de salir en los selectores, pero sus turnos se conservan. */
export async function archiveEmployer(id: string, archived = true): Promise<void> {
  await updateEmployer(id, { archived });
}
