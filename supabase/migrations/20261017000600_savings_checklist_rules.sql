-- =====================================================================
-- Fase 3: ahorro USD/PEN, meta de ahorro y checklist de fin de temporada.
-- Cada movimiento guarda el tipo de cambio que se usó (BCRP, interbancario venta).
-- =====================================================================

alter table public.profiles
  add column if not exists savings_goal_cents integer check (savings_goal_cents >= 0),
  add column if not exists checklist_done text[] not null default '{}';

create table if not exists public.savings (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('save', 'withdraw')),
  date          date not null,
  amount_cents  integer not null check (amount_cents > 0),
  fx_rate       numeric(8, 4) check (fx_rate > 0),
  fx_date       date,
  fx_source     text check (fx_source in ('bcrp', 'manual')),
  note          text not null default '' check (char_length(note) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  synced_at     timestamptz not null default now()
);

comment on column public.savings.fx_rate is 'Soles por dólar usados en este movimiento. No se recalcula con el tipo de cambio del día.';

create index if not exists savings_user_date_idx   on public.savings (user_id, date);
create index if not exists savings_user_synced_idx on public.savings (user_id, synced_at);

create trigger a_lww_guard before update on public.savings
  for each row execute function public.lww_guard();
create trigger b_set_synced_at before insert or update on public.savings
  for each row execute function public.set_synced_at();

alter table public.savings enable row level security;
alter table public.savings force row level security;

create policy savings_select_own on public.savings for select to authenticated using (user_id = (select auth.uid()));
create policy savings_insert_own on public.savings for insert to authenticated with check (user_id = (select auth.uid()));
create policy savings_update_own on public.savings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy savings_delete_own on public.savings for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.savings to authenticated;

-- Reglas nuevas. Deben coincidir con src/data/seed/rules.json.
-- fx_usd_pen_series usa jurisdicción 'PE' (Perú): es la fuente del tipo de cambio, no una regla tributaria.
insert into public.tax_rules (key, jurisdiction, year, value, source_url, verified_at, reviewed_by, notes)
values
  ('fx_usd_pen_series', 'PE', 2026,
    '{"provider": "BCRP", "series": "PD04638PD", "name": "TC Interbancario (S/ por US$) - Venta", "frequency": "daily", "api": "https://estadisticas.bcrp.gob.pe/estadisticas/series/api/{series}/json/{from}/{to}/esp"}'::jsonb,
    'https://estadisticas.bcrp.gob.pe/estadisticas/series/diarias/tipo-de-cambio', '2026-10-17', null,
    'Código confirmado en la lista de series diarias de tipo de cambio del BCRP.'),
  ('form_8843_filing', 'federal', 2025,
    '{"edition": "Form 8843 (2025)", "who": "alien individuals who were exempt individuals (or unable to leave due to a medical condition)", "with_1040nr": "attach to Form 1040-NR", "without_return_mail_to": "Department of the Treasury, Internal Revenue Service Center, Austin, TX 73301-0215", "deadline": "due date (including extensions) for filing Form 1040-NR"}'::jsonb,
    'https://www.irs.gov/pub/irs-pdf/f8843.pdf', '2026-10-17', 'pendiente Enrolled Agent',
    'Quién debe presentarlo y a dónde enviarlo si no presenta declaración. La fecha exacta depende del vencimiento del 1040-NR de cada año.'),
  ('form_1040nr_purpose', 'federal', 2025,
    '{"who": "nonresident alien individuals, estates, and trusts file a U.S. income tax return"}'::jsonb,
    'https://www.irs.gov/forms-pubs/about-form-1040-nr', '2026-10-17', 'pendiente Enrolled Agent',
    'Formulario de declaración de no residentes.')
on conflict (key, jurisdiction, year) do update
  set value = excluded.value, source_url = excluded.source_url, verified_at = excluded.verified_at,
      reviewed_by = excluded.reviewed_by, notes = excluded.notes, updated_at = now();

revoke all on public.savings from anon;
