/**
 * RLS de feedback, probado contra la migración real (20261017000800_preseason.sql)
 * en un Postgres en memoria (PGlite). Simula los roles de Supabase:
 * anon (sin sesión), authenticated (con sesión) y un admin (fila en public.admins).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL('../migrations/20261017000800_preseason.sql', import.meta.url)), 'utf8');
const section = (from: string, to: string) => migration.slice(migration.indexOf(from), migration.indexOf(to));

const ADMIN = '00000000-0000-0000-0000-00000000000a';
const USER = '00000000-0000-0000-0000-00000000000b';
const OTHER = '00000000-0000-0000-0000-00000000000c';
const INSTALL = '11111111-1111-1111-1111-111111111111';

let db: PGlite;

/** Corre una consulta como un rol de Supabase (y opcionalmente con un usuario en sesión). */
async function as<T = Record<string, unknown>>(role: 'anon' | 'authenticated', sub: string | null, sql: string): Promise<T[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ''}', false); set role ${role};`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec('reset role;');
  }
}

const insertSql = (userId: string | null, rating = 4) =>
  `insert into public.feedback (install_id, user_id, rating, what_failed, app_version, os, screen, lang)
   values ('${INSTALL}', ${userId ? `'${userId}'` : 'null'}, ${rating}, 'algo falló', '0.1.0', 'iOS 17.4', '/paystubs', 'es')`;

beforeAll(async () => {
  db = new PGlite();
  // Lo mínimo de Supabase que la migración necesita.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${ADMIN}'), ('${USER}'), ('${OTHER}');
  `);
  // Secciones reales de la migración: admins + is_admin() y feedback.
  await db.exec(section('-- ---------- admins ----------', '-- ---------- survey_responses ----------'));
  // Igual que la migración 0810 para esta tabla.
  await db.exec(`
    revoke update, delete on public.feedback from anon, authenticated;
    revoke select on public.feedback from anon;
    insert into public.admins values ('${ADMIN}');
  `);
});

afterAll(async () => {
  await db?.close();
});

describe('RLS de feedback', () => {
  it('sin sesión (anon) se puede enviar feedback', async () => {
    await expect(as('anon', null, insertSql(null))).resolves.toBeDefined();
  });

  it('anon no puede leer el feedback', async () => {
    await expect(as('anon', null, 'select * from public.feedback')).rejects.toThrow(/permission denied/);
  });

  it('un usuario con sesión puede enviar el suyo', async () => {
    await expect(as('authenticated', USER, insertSql(USER))).resolves.toBeDefined();
  });

  it('no se puede enviar feedback a nombre de otro usuario', async () => {
    await expect(as('authenticated', USER, insertSql(OTHER))).rejects.toThrow(/row-level security/);
  });

  it('anon tampoco puede ponerle el user_id de alguien', async () => {
    await expect(as('anon', null, insertSql(OTHER))).rejects.toThrow(/row-level security/);
  });

  it('un usuario normal no ve nada, ni siquiera lo suyo', async () => {
    const rows = await as('authenticated', USER, 'select id from public.feedback');
    expect(rows).toHaveLength(0);
  });

  it('el admin ve todo el feedback', async () => {
    const rows = await as('authenticated', ADMIN, 'select id from public.feedback');
    expect(rows.length).toBe(2);
  });

  it('nadie puede editar ni borrar feedback desde la app', async () => {
    await expect(as('authenticated', ADMIN, `update public.feedback set rating = 1`)).rejects.toThrow(/permission denied/);
    await expect(as('authenticated', USER, `delete from public.feedback`)).rejects.toThrow(/permission denied/);
    await expect(as('anon', null, `delete from public.feedback`)).rejects.toThrow(/permission denied/);
  });

  it('las restricciones de datos se respetan (calificación 1 a 5)', async () => {
    await expect(as('anon', null, insertSql(null, 9))).rejects.toThrow(/check constraint/);
  });
});

describe('límite anti-abuso de feedback (20261031001030_rate_limits.sql)', () => {
  beforeAll(async () => {
    const rl = readFileSync(fileURLToPath(new URL('../migrations/20261031001030_rate_limits.sql', import.meta.url)), 'utf8');
    // La función y el trigger de feedback (las otras tablas no existen en esta base de prueba).
    await db.exec(rl.slice(rl.indexOf('create or replace function'), rl.indexOf('create index')));
    await db.exec(rl.slice(rl.indexOf('create trigger feedback_rate_limit'), rl.indexOf('create trigger survey_rate_limit')));
  });

  it('un mismo celular puede mandar hasta 10 por hora; el 11.º se rechaza', async () => {
    // Ya hay 2 de este install (de las pruebas de arriba)
    for (let i = 0; i < 8; i++) await as('anon', null, insertSql(null));
    await expect(as('anon', null, insertSql(null))).rejects.toThrow(/rate_limit/);
  });

  it('otro celular no se ve afectado', async () => {
    await expect(
      as('anon', null, insertSql(null).replace(INSTALL, '22222222-2222-2222-2222-222222222222')),
    ).resolves.toBeDefined();
  });
});
