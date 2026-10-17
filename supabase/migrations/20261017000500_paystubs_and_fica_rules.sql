-- =====================================================================
-- Fase 2: boletas de pago (paystubs), años en estatus F/J para FICA
-- y reglas de Social Security/Medicare de la Publication 519 (2025).
-- Privacidad: la boleta guarda montos y horas; nunca SSN ni datos bancarios.
-- =====================================================================

alter table public.profiles
  add column if not exists fj_prior_years smallint check (fj_prior_years between 0 and 60);

comment on column public.profiles.fj_prior_years is 'Años calendario anteriores al actual en EE. UU. con visa F, J, M o Q (lo declara el usuario).';

create table if not exists public.paystubs (
  id                      uuid primary key,
  user_id                 uuid not null default auth.uid() references auth.users (id) on delete cascade,
  employer_id             uuid not null,
  period_start            date not null,
  period_end              date not null,
  pay_date                date not null,
  regular_minutes         integer not null default 0 check (regular_minutes >= 0),
  overtime_minutes        integer not null default 0 check (overtime_minutes >= 0),
  gross_cents             integer not null default 0 check (gross_cents >= 0),
  tips_cents              integer not null default 0 check (tips_cents >= 0),
  federal_tax_cents       integer not null default 0 check (federal_tax_cents >= 0),
  state_tax_cents         integer not null default 0 check (state_tax_cents >= 0),
  social_security_cents   integer not null default 0 check (social_security_cents >= 0),
  medicare_cents          integer not null default 0 check (medicare_cents >= 0),
  other_deductions_cents  integer not null default 0 check (other_deductions_cents >= 0),
  net_cents               integer not null default 0 check (net_cents >= 0),
  note                    text not null default '' check (char_length(note) <= 500),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  synced_at               timestamptz not null default now(),
  constraint paystubs_period_order check (period_end >= period_start),
  constraint paystubs_employer_fk foreign key (employer_id, user_id)
    references public.employers (id, user_id) on delete cascade
);

create index if not exists paystubs_user_period_idx on public.paystubs (user_id, period_end);
create index if not exists paystubs_user_synced_idx on public.paystubs (user_id, synced_at);
create index if not exists paystubs_employer_idx    on public.paystubs (employer_id, user_id);

create trigger a_lww_guard before update on public.paystubs
  for each row execute function public.lww_guard();
create trigger b_set_synced_at before insert or update on public.paystubs
  for each row execute function public.set_synced_at();

alter table public.paystubs enable row level security;
alter table public.paystubs force row level security;

create policy paystubs_select_own on public.paystubs for select to authenticated using (user_id = (select auth.uid()));
create policy paystubs_insert_own on public.paystubs for insert to authenticated with check (user_id = (select auth.uid()));
create policy paystubs_update_own on public.paystubs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy paystubs_delete_own on public.paystubs for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.paystubs from anon;
grant select, insert, update, delete on public.paystubs to authenticated;

-- Reglas FICA. Fuente: IRS Publication 519 (2025), capítulos 1 y 8. Debe coincidir con src/data/seed/rules.json.
insert into public.tax_rules (key, jurisdiction, year, value, source_url, verified_at, reviewed_by, notes)
values
  ('fica_exemption_nonresident_fjmq', 'federal', 2025,
    '{"edition": "Publication 519 (2025)", "visa_classes": ["F","J","M","Q"], "requires_nonresident_alien": true, "requires_purpose_of_visa": true, "j_requires_sponsor_authorization_letter": true, "not_covered": ["F-2","J-2","M-2","Q-3"]}'::jsonb,
    'https://www.irs.gov/publications/p519', '2026-10-17', 'pendiente Enrolled Agent',
    'Servicios de no residentes F/J/M/Q hechos para cumplir el propósito de la visa no están cubiertos por Social Security. Exchange visitors: con permiso de trabajo y carta de autorización del sponsor. Si es residente fiscal, sí se retiene.'),
  ('exempt_individual_student', 'federal', 2025,
    '{"edition": "Publication 519 (2025)", "calendar_years_limit": 5, "visa_classes": ["F","J","M","Q"], "exception": "may remain exempt if no intent to reside permanently and substantial compliance with visa"}'::jsonb,
    'https://www.irs.gov/publications/p519', '2026-10-17', 'pendiente Enrolled Agent',
    'No es exempt individual como estudiante si fue exento como profesor, trainee o estudiante en alguna parte de más de 5 años calendario, salvo la excepción indicada.'),
  ('exempt_individual_teacher_trainee', 'federal', 2025,
    '{"edition": "Publication 519 (2025)", "preceding_years_window": 6, "max_prior_years": 2, "visa_classes": ["J","Q"], "exception": "foreign employer paid all compensation (3 or fewer of 6 preceding years)"}'::jsonb,
    'https://www.irs.gov/publications/p519', '2026-10-17', 'pendiente Enrolled Agent',
    'No es exempt individual como profesor o trainee si fue exento en alguna parte de 2 de los 6 años calendario anteriores, salvo la excepción del empleador extranjero.'),
  ('fica_refund_procedure', 'federal', 2025,
    '{"edition": "Publication 519 (2025)", "steps": ["ask_employer","form_843"], "attachments": ["form_w2","visa_copy","form_i94","form_ds2019_if_j1","employer_statement_or_form_8316","pay_statements_if_partial_year"], "mail_to": "Department of the Treasury, Internal Revenue Service Center, Ogden, UT 84201-0038", "form_843_url": "https://www.irs.gov/forms-pubs/about-form-843", "form_8316_url": "https://www.irs.gov/forms-pubs/about-form-8316"}'::jsonb,
    'https://www.irs.gov/publications/p519', '2026-10-17', 'pendiente Enrolled Agent',
    'Primero pedir el reembolso al empleador. Si no devuelve todo, Form 843 con los adjuntos listados.')
on conflict (key, jurisdiction, year) do update
  set value = excluded.value, source_url = excluded.source_url, verified_at = excluded.verified_at,
      reviewed_by = excluded.reviewed_by, notes = excluded.notes, updated_at = now();
