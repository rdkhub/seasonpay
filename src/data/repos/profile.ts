import { db, type ProfileRow } from '../db';
import { enqueue } from '../outbox';

export async function getProfile(): Promise<ProfileRow | undefined> {
  return db.profile.get('me');
}

export async function saveProfile(patch: Partial<Omit<ProfileRow, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ProfileRow> {
  return db.transaction('rw', db.profile, db.outbox, async () => {
    const now = Date.now();
    const current = await db.profile.get('me');
    const next: ProfileRow = {
      id: 'me',
      language: 'system',
      visaType: null,
      arrivalYear: null,
      workState: null,
      onboardedAt: null,
      createdAt: current?.createdAt ?? now,
      ...current,
      ...patch,
      updatedAt: now,
    };
    await db.profile.put(next);
    await enqueue('profiles', 'me');
    return next;
  });
}
