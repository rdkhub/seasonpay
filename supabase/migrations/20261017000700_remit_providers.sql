-- =====================================================================
-- Proveedores para enviar plata de EE. UU. a Perú.
-- Solo datos de la página oficial de cada uno (fuente y fecha obligatorias).
-- Sin comisiones ni tipos de cambio: cambian a diario.
-- Lectura pública; escritura solo con service_role (panel o scripts).
-- referral_url: link de referido opcional. La app lo muestra siempre marcado.
-- =====================================================================

create table if not exists public.remit_providers (
  id                  text primary key check (id ~ '^[a-z0-9_]+$'),
  name                text not null check (char_length(name) between 1 and 80),
  url                 text not null check (url ~ '^https://'),
  methods             text[] not null check (methods <@ array['bank', 'cash', 'wallet']::text[] and cardinality(methods) > 0),
  receive_currencies  text[] not null check (receive_currencies <@ array['PEN', 'USD']::text[] and cardinality(receive_currencies) > 0),
  wallets             text[] not null default '{}',
  referral_url        text check (referral_url is null or referral_url ~ '^https://'),
  source_urls         text[] not null check (cardinality(source_urls) > 0),
  verified_at         date not null,
  active              boolean not null default true,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  synced_at           timestamptz not null default now()
);

comment on table  public.remit_providers is 'Proveedores de envío EE. UU. → Perú. Datos de su página oficial; sin tarifas.';
comment on column public.remit_providers.referral_url is 'Link de referido de SeasonPay. Si existe, la app lo etiqueta como referido y no cambia el orden.';

create index if not exists remit_providers_synced_idx on public.remit_providers (synced_at);

create trigger b_set_synced_at before insert or update on public.remit_providers
  for each row execute function public.set_synced_at();

alter table public.remit_providers enable row level security;
alter table public.remit_providers force row level security;

create policy remit_providers_public_read on public.remit_providers
  for select to anon, authenticated using (true);

grant select on public.remit_providers to anon, authenticated;

insert into public.remit_providers (id, name, url, methods, receive_currencies, wallets, referral_url, source_urls, verified_at) values
  ('moneygram', 'MoneyGram', 'https://www.moneygram.com/us/en/corridor/peru',
   array['bank','cash','wallet'], array['PEN','USD'], array['Yape','Plin'], null,
   array['https://www.moneygram.com/r/pe/en','https://developer.moneygram.com/moneygram-developer/docs/direct-send-options-for-pe'], '2026-10-17'),
  ('remitly', 'Remitly', 'https://www.remitly.com/us/en/money-transfer/send-money-to-peru',
   array['bank','cash','wallet'], array['PEN','USD'], array[]::text[], null,
   array['https://www.remitly.com/us/en/money-transfer/send-money-to-peru','https://www.remitly.com/us/en/peru/pricing'], '2026-10-17'),
  ('western_union', 'Western Union', 'https://www.westernunion.com/us/en/send-money-to-peru.html',
   array['bank','cash','wallet'], array['PEN','USD'], array['Yape'], null,
   array['https://www.westernunion.com/us/en/send-money-to-peru.html'], '2026-10-17'),
  ('wise', 'Wise', 'https://wise.com/us/send-money/send-money-to-peru',
   array['bank'], array['PEN'], array[]::text[], null,
   array['https://wise.com/us/send-money/send-money-to-peru'], '2026-10-17'),
  ('xoom', 'Xoom', 'https://www.xoom.com/peru',
   array['bank','cash','wallet'], array['PEN','USD'], array['Yape'], null,
   array['https://www.xoom.com/peru'], '2026-10-17')
on conflict (id) do nothing;
