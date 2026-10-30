-- =====================================================================
-- Tipo de cambio diario guardado por SeasonPay.
-- Desde oct-2026 el API del BCRP responde a consultas automáticas con una página anti-bots.
-- Respaldo: el archivo público de SUNAT (fecha|compra|venta), que solo trae el día actual.
-- La Edge Function fx-snapshot lo guarda cada día aquí para tener historial
-- (los ahorros guardados sin señal se completan con este valor).
-- =====================================================================

create table if not exists public.fx_daily (
  date         date not null,
  provider     text not null check (provider in ('bcrp', 'sunat')),
  buy          numeric(8, 4) check (buy > 0),
  sell         numeric(8, 4) not null check (sell > 0),
  source_url   text not null check (source_url ~ '^https://'),
  fetched_at   timestamptz not null default now(),
  primary key (date, provider)
);
comment on table public.fx_daily is 'USD→PEN por día. sell = venta. Lectura pública; la escribe la Edge Function fx-snapshot.';

alter table public.fx_daily enable row level security;
alter table public.fx_daily force row level security;
create policy fx_daily_public_read on public.fx_daily for select to anon, authenticated using (true);
grant select on public.fx_daily to anon, authenticated;

-- Fuente de respaldo documentada en tax_rules (la app muestra fuente y fecha).
insert into public.tax_rules (key, value, year, jurisdiction, source_url, verified_at, reviewed_by, notes) values
  ('fx_usd_pen_fallback',
   '{"provider": "sunat", "format": "dd/mm/yyyy|compra|venta", "use": "venta", "reason": "BCRP API devuelve una página anti-bots a consultas automáticas desde oct-2026"}',
   2026, 'PE', 'https://www.sunat.gob.pe/a/txt/tipoCambio.txt', '2026-10-30', 'pendiente Enrolled Agent',
   'Tipo de cambio publicado por SUNAT. Solo se usa si el BCRP no responde.')
on conflict (key, jurisdiction, year) do nothing;

-- Snapshot diario: 15:00 UTC (10:00 en Lima) y 21:00 UTC por si SUNAT publica tarde.
select cron.schedule(
  'seasonpay-fx-snapshot',
  '0 15,21 * * *',
  $cron$
  select net.http_post(
    url := 'https://qjmtgrxyjtomirzhdvdq.supabase.co/functions/v1/fx-snapshot',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.internal_get_secret('cron_secret')),
    body := '{}'::jsonb
  );
  $cron$
);
