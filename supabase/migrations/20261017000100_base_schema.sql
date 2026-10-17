-- =====================================================================
-- SeasonPay: esquema base (profiles, employers, shifts)
-- Offline-first: el celular es la fuente de verdad y sincroniza aquí.
--   updated_at : lo pone el cliente; se usa para last-write-wins.
--   synced_at  : lo pone el servidor; es el cursor para bajar cambios.
--   deleted_at : lápida para sincronizar borrados.
-- Privacidad: aquí no se guarda SSN, pasaporte, ITIN ni datos bancarios.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------

-- Ignora un UPDATE cuya versión (updated_at) sea más vieja que la guardada.
-- Devolver NULL en un trigger BEFORE UPDATE cancela la actualización de esa fila
-- (también dentro de INSERT ... ON CONFLICT DO UPDATE, que es lo que hace upsert).
create or replace function public.lww_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

-- Marca la hora del servidor en cada escritura (cursor de sincronización).
create or replace function public.set_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.synced_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: una fila por usuario (id = auth.users.id)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  language      text not null default 'system' check (language in ('system', 'es', 'en')),
  visa_type     text check (visa_type in ('j1_student', 'j1_other', 'h2b', 'other')),
  arrival_year  smallint check (arrival_year between 1990 and 2100),
  work_state    text check (work_state ~ '^[A-Z]{2}$'),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  synced_at     timestamptz not null default now()
);

comment on table public.profiles is 'Preferencias y datos de bienvenida. Sin documentos de identidad ni datos bancarios.';

-- ---------------------------------------------------------------------
-- employers
-- ---------------------------------------------------------------------
create table if not exists public.employers (
  id                        uuid primary key,
  user_id                   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                      text not null check (char_length(name) between 1 and 120),
  hourly_rate_cents         integer not null check (hourly_rate_cents >= 0),
  pay_frequency             text not null check (pay_frequency in ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  workweek_start_day        smallint not null default 1 check (workweek_start_day between 0 and 6),
  overtime_enabled          boolean not null default true,
  overtime_threshold_hours  numeric(5, 2) not null default 0 check (overtime_threshold_hours >= 0),
  overtime_multiplier       numeric(4, 2) not null default 1 check (overtime_multiplier >= 1),
  overtime_rule_key         text,
  archived                  boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  synced_at                 timestamptz not null default now(),
  -- Permite que shifts referencie (id, user_id) y así no pueda apuntar a un empleador ajeno.
  constraint employers_id_user_unique unique (id, user_id)
);

comment on column public.employers.overtime_rule_key is 'id de la regla de tax_rules de la que salieron los valores de overtime (jurisdiccion:key:año).';

-- ---------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------
create table if not exists public.shifts (
  id               uuid primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  employer_id      uuid not null,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  break_minutes    integer not null default 0 check (break_minutes >= 0),
  cash_tips_cents  integer not null default 0 check (cash_tips_cents >= 0),
  card_tips_cents  integer not null default 0 check (card_tips_cents >= 0),
  note             text not null default '' check (char_length(note) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  synced_at        timestamptz not null default now(),
  constraint shifts_end_after_start check (ended_at is null or ended_at > started_at),
  constraint shifts_max_24h check (ended_at is null or ended_at - started_at <= interval '24 hours'),
  constraint shifts_employer_fk foreign key (employer_id, user_id)
    references public.employers (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index if not exists employers_user_synced_idx on public.employers (user_id, synced_at);
create index if not exists shifts_user_started_idx   on public.shifts (user_id, started_at);
create index if not exists shifts_user_synced_idx    on public.shifts (user_id, synced_at);
create index if not exists shifts_employer_idx       on public.shifts (employer_id, user_id);
create index if not exists profiles_synced_idx       on public.profiles (synced_at);

-- ---------------------------------------------------------------------
-- Triggers (se ejecutan en orden alfabético: primero a_, después b_)
-- ---------------------------------------------------------------------
drop trigger if exists a_lww_guard on public.profiles;
create trigger a_lww_guard before update on public.profiles
  for each row execute function public.lww_guard();
drop trigger if exists b_set_synced_at on public.profiles;
create trigger b_set_synced_at before insert or update on public.profiles
  for each row execute function public.set_synced_at();

drop trigger if exists a_lww_guard on public.employers;
create trigger a_lww_guard before update on public.employers
  for each row execute function public.lww_guard();
drop trigger if exists b_set_synced_at on public.employers;
create trigger b_set_synced_at before insert or update on public.employers
  for each row execute function public.set_synced_at();

drop trigger if exists a_lww_guard on public.shifts;
create trigger a_lww_guard before update on public.shifts
  for each row execute function public.lww_guard();
drop trigger if exists b_set_synced_at on public.shifts;
create trigger b_set_synced_at before insert or update on public.shifts
  for each row execute function public.set_synced_at();

-- ---------------------------------------------------------------------
-- RLS: cada usuario ve y modifica solo lo suyo
-- ---------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.employers enable row level security;
alter table public.shifts    enable row level security;

alter table public.profiles  force row level security;
alter table public.employers force row level security;
alter table public.shifts    force row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

-- employers
drop policy if exists employers_select_own on public.employers;
create policy employers_select_own on public.employers
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists employers_insert_own on public.employers;
create policy employers_insert_own on public.employers
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists employers_update_own on public.employers;
create policy employers_update_own on public.employers
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists employers_delete_own on public.employers;
create policy employers_delete_own on public.employers
  for delete to authenticated using (user_id = (select auth.uid()));

-- shifts
drop policy if exists shifts_select_own on public.shifts;
create policy shifts_select_own on public.shifts
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists shifts_insert_own on public.shifts;
create policy shifts_insert_own on public.shifts
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists shifts_update_own on public.shifts;
create policy shifts_update_own on public.shifts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists shifts_delete_own on public.shifts;
create policy shifts_delete_own on public.shifts
  for delete to authenticated using (user_id = (select auth.uid()));

-- Sin acceso anónimo a datos personales.
revoke all on public.profiles, public.employers, public.shifts from anon;
grant select, insert, update, delete on public.profiles, public.employers, public.shifts to authenticated;
