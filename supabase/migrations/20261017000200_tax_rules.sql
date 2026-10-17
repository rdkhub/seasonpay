-- =====================================================================
-- tax_rules: toda regla tributaria o laboral que use la app vive aquí.
-- Nada de cifras escritas a mano en el código.
-- Lectura pública (no son datos personales). Escritura solo con service_role
-- (panel de Supabase o scripts de mantenimiento), para que el Enrolled Agent
-- revise y firme cada cambio.
-- =====================================================================

create table if not exists public.tax_rules (
  id            uuid primary key default gen_random_uuid(),
  key           text not null check (key ~ '^[a-z0-9_]+$'),
  value         jsonb not null,
  year          smallint not null check (year between 2000 and 2100),
  jurisdiction  text not null check (jurisdiction = 'federal' or jurisdiction ~ '^[A-Z]{2}$'),
  source_url    text not null check (source_url ~ '^https://'),
  verified_at   date not null,
  reviewed_by   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  synced_at     timestamptz not null default now(),
  constraint tax_rules_unique unique (key, jurisdiction, year)
);

comment on table  public.tax_rules is 'Reglas oficiales versionadas por año y jurisdicción. Fuente primaria obligatoria.';
comment on column public.tax_rules.jurisdiction is 'federal o código de estado de 2 letras (MT, CO, UT…).';
comment on column public.tax_rules.reviewed_by is 'Quién validó la regla (ej. nombre del Enrolled Agent). "pendiente ..." mientras no se revise.';

create index if not exists tax_rules_lookup_idx on public.tax_rules (key, jurisdiction, year desc);
create index if not exists tax_rules_synced_idx on public.tax_rules (synced_at);

drop trigger if exists b_set_synced_at on public.tax_rules;
create trigger b_set_synced_at before insert or update on public.tax_rules
  for each row execute function public.set_synced_at();

alter table public.tax_rules enable row level security;
alter table public.tax_rules force row level security;

drop policy if exists tax_rules_public_read on public.tax_rules;
create policy tax_rules_public_read on public.tax_rules
  for select to anon, authenticated using (true);

-- Sin políticas de insert/update/delete: solo service_role (que salta RLS) puede escribir.
revoke insert, update, delete on public.tax_rules from anon, authenticated;
grant select on public.tax_rules to anon, authenticated;

-- Vista para la revisión del Enrolled Agent: lo pendiente primero.
create or replace view public.tax_rules_review
with (security_invoker = true) as
select
  jurisdiction,
  key,
  year,
  value,
  source_url,
  verified_at,
  coalesce(reviewed_by, 'sin revisar') as reviewed_by,
  (reviewed_by is null or reviewed_by ilike 'pendiente%') as pending_review,
  notes
from public.tax_rules
order by pending_review desc, jurisdiction, key, year desc;
