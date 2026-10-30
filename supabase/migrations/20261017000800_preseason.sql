-- =====================================================================
-- Pre-temporada (piloto 18-dic-2026 a 30-mar-2027)
-- - app_config: interruptores públicos (referidos, link de WhatsApp, versión de la política).
-- - admins + is_admin(): quién puede leer feedback y métricas.
-- - feedback, survey_responses, events: solo INSERT desde la app; lectura solo admin.
--   Se identifican por install_id (UUID aleatorio del celular), nunca por correo.
-- - push_subscriptions: notificaciones de recordatorio (solo por RPC).
-- - delete_install_data(): "Borrar mi cuenta" también borra lo anterior de ese celular.
-- - profiles: consentimiento y opción de no enviar métricas.
-- - remit_providers v2: tipo, países, referral_enabled, last_checked (= verified_at); tasas en vivo (vacío).
-- - Vistas de métricas del piloto.
-- =====================================================================

-- ---------- app_config ----------
create table if not exists public.app_config (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  value       jsonb not null,
  notes       text,
  updated_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now()
);
comment on table public.app_config is 'Interruptores públicos de la app. Se editan desde el panel (service_role).';

create trigger b_set_synced_at before insert or update on public.app_config
  for each row execute function public.set_synced_at();

alter table public.app_config enable row level security;
alter table public.app_config force row level security;
create policy app_config_public_read on public.app_config for select to anon, authenticated using (true);
grant select on public.app_config to anon, authenticated;

insert into public.app_config (key, value, notes) values
  ('referrals_enabled', 'false', 'Interruptor global. false = links normales; true = links de referido donde referral_enabled y referral_url existan.'),
  ('whatsapp_group_url', 'null', 'Link al grupo de WhatsApp de testers (https://chat.whatsapp.com/...). null = no se muestra.'),
  ('privacy_policy_version', '"2026-10-17"', 'Si cambia, la app vuelve a pedir el consentimiento.'),
  ('vapid_public_key', 'null', 'Llave pública de Web Push. La escribe la Edge Function send-reminders la primera vez.')
on conflict (key) do nothing;

-- ---------- admins ----------
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
comment on table public.admins is 'Usuarios que ven feedback y métricas. Se agregan desde el SQL Editor.';
alter table public.admins enable row level security;
alter table public.admins force row level security;
-- Sin políticas: nadie la lee ni escribe desde la app.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- feedback ----------
create table if not exists public.feedback (
  id               uuid primary key default gen_random_uuid(),
  install_id       uuid not null,
  user_id          uuid default auth.uid() references auth.users (id) on delete cascade,
  rating           smallint not null check (rating between 1 and 5),
  what_failed      text not null default '' check (char_length(what_failed) <= 2000),
  wish             text not null default '' check (char_length(wish) <= 2000),
  -- Captura de la pantalla de la app (JPEG en data URL). La app nunca muestra SSN ni pasaporte.
  screenshot       text check (screenshot is null or (screenshot like 'data:image/jpeg;base64,%' and char_length(screenshot) <= 700000)),
  app_version      text not null check (char_length(app_version) <= 40),
  os               text not null check (char_length(os) <= 60),
  screen           text not null check (char_length(screen) <= 80),
  lang             text not null check (lang in ('es', 'en')),
  client_created_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_install_idx on public.feedback (install_id);

alter table public.feedback enable row level security;
alter table public.feedback force row level security;
create policy feedback_insert on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy feedback_admin_read on public.feedback for select to authenticated using (public.is_admin());
grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated;

-- ---------- survey_responses ----------
create table if not exists public.survey_responses (
  id               uuid primary key default gen_random_uuid(),
  install_id       uuid not null,
  user_id          uuid default auth.uid() references auth.users (id) on delete cascade,
  send_method      text not null check (send_method in ('remittance_app', 'bank_wire', 'cash_trip', 'exchange_house', 'not_sending', 'other')),
  fx_loss_guess    text not null check (fx_loss_guess in ('lt1', '1to3', '3to5', 'gt5', 'unknown')),
  price_willing    text not null check (price_willing in ('free_only', 'usd1to3', 'usd4to7', 'usd8to12', 'gt12')),
  agency_include   text not null check (agency_include in ('yes', 'no', 'unsure')),
  comment          text not null default '' check (char_length(comment) <= 1000),
  app_version      text not null check (char_length(app_version) <= 40),
  lang             text not null check (lang in ('es', 'en')),
  client_created_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists survey_install_idx on public.survey_responses (install_id);

alter table public.survey_responses enable row level security;
alter table public.survey_responses force row level security;
create policy survey_insert on public.survey_responses for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy survey_admin_read on public.survey_responses for select to authenticated using (public.is_admin());
grant insert on public.survey_responses to anon, authenticated;
grant select on public.survey_responses to authenticated;

-- ---------- events (métricas sin datos personales) ----------
create table if not exists public.events (
  id               bigint generated always as identity primary key,
  install_id       uuid not null,
  name             text not null check (name in (
                     'signup', 'account_created', 'app_open', 'shift_logged', 'paystub_reviewed',
                     'discrepancy_detected', 'fica_alert_shown', 'feedback_sent', 'survey_sent',
                     'export_made', 'remit_quote_added', 'install_completed', 'push_enabled')),
  -- Solo valores categóricos pequeños (ej. {"screen":"paystubs"}). Nunca montos ni texto libre.
  props            jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 300),
  app_version      text not null check (char_length(app_version) <= 40),
  platform         text not null check (platform in ('ios', 'android', 'desktop', 'other')),
  standalone       boolean not null default false,
  client_at        timestamptz not null,
  created_at       timestamptz not null default now()
);
create index if not exists events_name_idx on public.events (name, client_at);
create index if not exists events_install_idx on public.events (install_id, client_at);

alter table public.events enable row level security;
alter table public.events force row level security;
create policy events_insert on public.events for insert to anon, authenticated with check (true);
create policy events_admin_read on public.events for select to authenticated using (public.is_admin());
grant insert on public.events to anon, authenticated;
grant select on public.events to authenticated;

-- ---------- push_subscriptions ----------
create table if not exists public.push_subscriptions (
  endpoint     text primary key check (endpoint ~ '^https://'),
  install_id   uuid not null,
  p256dh       text not null,
  auth         text not null,
  lang         text not null default 'es' check (lang in ('es', 'en')),
  topics       text[] not null default '{tax_deadlines}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists push_install_idx on public.push_subscriptions (install_id);

create table if not exists public.push_reminders_sent (
  endpoint      text not null references public.push_subscriptions (endpoint) on delete cascade,
  reminder_key  text not null,
  sent_at       timestamptz not null default now(),
  primary key (endpoint, reminder_key)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
alter table public.push_reminders_sent enable row level security;
alter table public.push_reminders_sent force row level security;
-- Sin políticas: la app solo entra por las funciones de abajo; la Edge Function usa service_role.

create or replace function public.save_push_subscription(p_install uuid, p_endpoint text, p_p256dh text, p_auth text, p_lang text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 or char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then
    raise exception 'invalid subscription';
  end if;
  insert into public.push_subscriptions (endpoint, install_id, p256dh, auth, lang)
  values (p_endpoint, p_install, p_p256dh, p_auth, case when p_lang = 'en' then 'en' else 'es' end)
  on conflict (endpoint) do update
    set install_id = excluded.install_id, p256dh = excluded.p256dh, auth = excluded.auth,
        lang = excluded.lang, updated_at = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

grant execute on function public.save_push_subscription(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;

-- ---------- borrar lo de un celular ----------
-- install_id es un UUID aleatorio que solo conoce ese celular: funciona como prueba de que es suyo.
create or replace function public.delete_install_data(p_install uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.feedback where install_id = p_install;
  delete from public.survey_responses where install_id = p_install;
  delete from public.events where install_id = p_install;
  delete from public.push_subscriptions where install_id = p_install;
end;
$$;
grant execute on function public.delete_install_data(uuid) to anon, authenticated;

-- ---------- secretos internos (solo service_role) ----------
-- Las funciones son ejecutables por PUBLIC por defecto: por eso validan el rol adentro
-- (además del revoke de la migración 0810). session_user, no current_user: dentro de una
-- función security definer, current_user es el dueño.
create or replace function public.internal_get_secret(p_name text)
returns text language plpgsql stable security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1);
end;
$$;

create or replace function public.internal_set_secret(p_name text, p_value text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then perform vault.create_secret(p_value, p_name);
  else perform vault.update_secret(v_id, p_value);
  end if;
end;
$$;

-- ---------- profiles: consentimiento ----------
alter table public.profiles
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text check (consent_version is null or char_length(consent_version) <= 20),
  add column if not exists analytics_opt_out boolean not null default false;

-- ---------- remit_providers v2 ----------
alter table public.remit_providers
  add column if not exists type text not null default 'remittance' check (type in ('remittance', 'exchange')),
  add column if not exists countries text[] not null default '{PE}' check (cardinality(countries) > 0),
  add column if not exists referral_enabled boolean not null default false,
  -- Nombre pedido para la tabla de configuración; es la misma fecha de verificación.
  add column if not exists last_checked date generated always as (verified_at) stored;

comment on column public.remit_providers.countries is 'Países de destino (ISO 3166-1 alfa-2) verificados en la web del proveedor.';
comment on column public.remit_providers.type is 'remittance = envía de EE. UU. al país; exchange = casa de cambio en el país (USD → moneda local).';

insert into public.remit_providers (id, name, url, type, countries, methods, receive_currencies, wallets, referral_url, source_urls, verified_at, notes) values
  ('worldremit', 'WorldRemit', 'https://www.worldremit.com/en-us/peru', 'remittance', array['PE'],
   array['bank','cash','wallet'], array['PEN','USD'], array[]::text[], null,
   array['https://www.worldremit.com/en-us/peru'], '2026-10-17', null),
  ('kambista', 'Kambista', 'https://kambista.com', 'exchange', array['PE'],
   array['bank'], array['PEN','USD'], array[]::text[], null,
   array['https://kambista.com'], '2026-10-17', 'Casa de cambio online. Su web indica registro SBS-UIF 00335-2017.'),
  ('rextie', 'Rextie', 'https://www.rextie.com', 'exchange', array['PE'],
   array['bank'], array['PEN','USD'], array[]::text[], null,
   array['https://www.rextie.com'], '2026-10-17', 'Casa de cambio online. Su web no muestra el registro SBS en la portada (pendiente de verificar en la SBS).'),
  ('tkambio', 'TKambio', 'https://tkambio.com', 'exchange', array['PE'],
   array['bank'], array['PEN','USD'], array[]::text[], null,
   array['https://tkambio.com'], '2026-10-17', 'Casa de cambio online. Su web indica inscripción en la SBS (Res. N° 03054-2017).')
on conflict (id) do nothing;

-- Tasas en vivo: estructura lista, sin datos. Cada tasa lleva fuente y fecha.
create table if not exists public.provider_rates (
  id            bigint generated always as identity primary key,
  provider_id   text not null references public.remit_providers (id) on delete cascade,
  country       text not null check (country ~ '^[A-Z]{2}$'),
  pair          text not null check (pair ~ '^[A-Z]{3}_[A-Z]{3}$'),
  rate          numeric(12, 6) not null check (rate > 0),
  fetched_at    timestamptz not null,
  source_url    text not null check (source_url ~ '^https://'),
  synced_at     timestamptz not null default now()
);
create index if not exists provider_rates_lookup_idx on public.provider_rates (provider_id, pair, fetched_at desc);
alter table public.provider_rates enable row level security;
alter table public.provider_rates force row level security;
create policy provider_rates_public_read on public.provider_rates for select to anon, authenticated using (true);
grant select on public.provider_rates to anon, authenticated;

-- ---------- reglas nuevas (fechas límite y Montana) ----------
insert into public.tax_rules (key, value, year, jurisdiction, source_url, verified_at, reviewed_by, notes) values
  ('form_1040nr_due_date',
   '{"employee_with_withholding": {"month_after_tax_year": 4, "day": 15, "calendar_year": "04-15"}, "others": {"month_after_tax_year": 6, "day": 15, "calendar_year": "06-15"}, "example_tax_year_2025": "2026-04-15", "weekend_holiday_rule_verified": false}',
   2025, 'federal', 'https://www.irs.gov/individuals/international-taxpayers/taxation-of-nonresident-aliens', '2026-10-17', 'pendiente Enrolled Agent',
   'IRS: empleados con sueldo sujeto a retención declaran el día 15 del 4.º mes después del fin del año tributario (15 de abril). Instrucciones 1040-NR (2025): 15-abr-2026. La regla de fin de semana/feriado no se verificó.'),
  ('state_return_nonresident',
   '{"must_file_if": "federal filing requirement and Montana source income", "nonresident_wages_are_montana_source": true, "exclusion": "nonresidents who earned only wages for services performed in Montana for 30 days or less and worked in more than one state", "seasonal_worker_is_not_part_year_resident": true}',
   2024, 'MT', 'https://revenue.mt.gov/taxes/individual-income-tax/filing-requirements', '2026-10-17', 'pendiente Enrolled Agent',
   'Aplica a años tributarios que empiezan después del 31-dic-2023. Residencia: https://revenue.mt.gov/taxes/individual-income-tax/residency'),
  ('state_return_due_date',
   '{"calendar_year": "04-15", "extension": "10-15", "form": "Form 2"}',
   2026, 'MT', 'https://revenue.mt.gov/taxes/individual-income-tax', '2026-10-17', 'pendiente Enrolled Agent', null)
on conflict (key, jurisdiction, year) do nothing;

-- ---------- vistas de métricas del piloto (solo admin, por RLS de events) ----------
create or replace view public.metrics_registered with (security_invoker = true) as
select
  count(distinct install_id) filter (where name = 'signup')          as installs_registered,
  count(distinct install_id) filter (where name = 'account_created') as installs_with_account,
  count(distinct install_id) filter (where name = 'install_completed') as installs_pwa,
  count(distinct install_id)                                          as installs_any_event
from public.events;

create or replace view public.metrics_retention with (security_invoker = true) as
with cohort as (
  select install_id, min(client_at) as signup_at
  from public.events where name = 'signup' group by install_id
),
activity as (
  select c.install_id, c.signup_at,
         bool_or(e.client_at >= c.signup_at + interval '14 days') as active_after_2w,
         bool_or(e.client_at >= c.signup_at + interval '28 days') as active_after_4w
  from cohort c join public.events e on e.install_id = c.install_id
  group by c.install_id, c.signup_at
)
select
  date_trunc('week', signup_at)::date                                         as cohort_week,
  count(*)                                                                    as installs,
  count(*) filter (where signup_at <= now() - interval '14 days')             as eligible_2w,
  count(*) filter (where active_after_2w)                                     as retained_2w,
  round(100.0 * count(*) filter (where active_after_2w)
        / nullif(count(*) filter (where signup_at <= now() - interval '14 days'), 0), 1) as pct_2w,
  count(*) filter (where signup_at <= now() - interval '28 days')             as eligible_4w,
  count(*) filter (where active_after_4w)                                     as retained_4w,
  round(100.0 * count(*) filter (where active_after_4w)
        / nullif(count(*) filter (where signup_at <= now() - interval '28 days'), 0), 1) as pct_4w
from activity
group by 1
order by 1;

create or replace view public.metrics_payment_errors with (security_invoker = true) as
select
  count(distinct install_id) filter (where name = 'paystub_reviewed')     as installs_reviewed,
  count(distinct install_id) filter (where name = 'discrepancy_detected') as installs_with_discrepancy,
  round(100.0 * count(distinct install_id) filter (where name = 'discrepancy_detected')
        / nullif(count(distinct install_id) filter (where name = 'paystub_reviewed'), 0), 1) as pct_with_discrepancy,
  count(distinct install_id) filter (where name = 'fica_alert_shown')     as installs_fica_alert
from public.events;

create or replace view public.metrics_feature_usage with (security_invoker = true) as
select name, count(*) as events, count(distinct install_id) as installs
from public.events
group by name
order by installs desc, events desc;

create or replace view public.metrics_weekly_active with (security_invoker = true) as
select date_trunc('week', client_at)::date as week, count(distinct install_id) as active_installs
from public.events
group by 1
order by 1;

grant select on public.metrics_registered, public.metrics_retention, public.metrics_payment_errors,
  public.metrics_feature_usage, public.metrics_weekly_active to authenticated;
