-- =====================================================================
-- Ahorro en la moneda de cada país (Perú, Argentina, Bolivia, Brasil, Chile, Colombia, Ecuador).
-- Cada movimiento guarda en qué moneda se guardó el tipo de cambio; nunca se recalcula.
-- Fuentes verificadas el 2026-10-30:
--   AR: BCRA, API Estadísticas Cambiarias v1.0 (cotización USD)          → automático
--   BR: Banco Central do Brasil, PTAX (cotação de venda)                 → automático
--   CO: TRM, Superintendencia Financiera (datos.gov.co, dataset 32sa-8pi3) → automático
--   CL: Banco Central de Chile, dólar observado (sin API pública sin registro) → a mano
--   BO: Banco Central de Bolivia, tipo de cambio oficial (sin API)        → a mano
--   EC: usa el dólar                                                       → sin conversión
-- =====================================================================

alter table public.profiles
  add column if not exists home_currency text not null default 'PEN'
  check (home_currency in ('PEN', 'ARS', 'BOB', 'BRL', 'CLP', 'COP', 'USD'));

alter table public.savings
  add column if not exists fx_currency text not null default 'PEN'
  check (fx_currency in ('PEN', 'ARS', 'BOB', 'BRL', 'CLP', 'COP', 'USD'));

-- El peso argentino y el colombiano superan 1.000 por dólar: más dígitos enteros.
alter table public.savings alter column fx_rate type numeric(12, 4);

alter table public.savings drop constraint if exists savings_fx_source_check;
alter table public.savings add constraint savings_fx_source_check
  check (fx_source in ('bcrp', 'sunat', 'bcra', 'ptax', 'trm', 'manual'));

comment on column public.profiles.home_currency is 'Moneda del país a donde va el ahorro.';
comment on column public.savings.fx_currency is 'Moneda del tipo de cambio guardado en este movimiento.';

insert into public.tax_rules (key, value, year, jurisdiction, source_url, verified_at, reviewed_by, notes) values
  ('fx_usd_local', '{"currency": "ARS", "mode": "api", "provider": "bcra", "label": {"es": "BCRA", "en": "BCRA"}, "api": "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD?fechadesde={from}&fechahasta={to}", "field": "results[].detalle[codigoMoneda=USD].tipoCotizacion"}'::jsonb,
   2026, 'AR', 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD', '2026-10-30', 'no aplica (tipo de cambio)', 'Banco Central de la República Argentina. Valor del 30-oct-2026: 1534.'),
  ('fx_usd_local', '{"currency": "BRL", "mode": "api", "provider": "ptax", "label": {"es": "Banco Central do Brasil (PTAX)", "en": "Banco Central do Brasil (PTAX)"}, "api": "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo", "field": "value[].cotacaoVenda"}'::jsonb,
   2026, 'BR', 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia', '2026-10-30', 'no aplica (tipo de cambio)', 'Cotação PTAX de venda. Valor del 29-oct-2026: 5,3744.'),
  ('fx_usd_local', '{"currency": "COP", "mode": "api", "provider": "trm", "label": {"es": "TRM (Superfinanciera)", "en": "TRM (Financial Superintendence)"}, "api": "https://www.datos.gov.co/resource/32sa-8pi3.json", "field": "valor (vigenciadesde..vigenciahasta)"}'::jsonb,
   2026, 'CO', 'https://www.datos.gov.co/resource/32sa-8pi3.json', '2026-10-30', 'no aplica (tipo de cambio)', 'Tasa Representativa del Mercado certificada por la Superintendencia Financiera de Colombia. Valor del 30-oct-2026: 3166,91.'),
  ('fx_usd_local', '{"currency": "CLP", "mode": "manual", "label": {"es": "el Banco Central de Chile (dólar observado)", "en": "the Central Bank of Chile (dólar observado)"}, "page_url": "https://www.bcentral.cl"}'::jsonb,
   2026, 'CL', 'https://www.bcentral.cl', '2026-10-30', 'no aplica (tipo de cambio)', 'Su API exige registro con usuario y clave; la app pide copiar el dólar observado de la portada. Valor visto el 30-oct-2026: 993,22.'),
  ('fx_usd_local', '{"currency": "BOB", "mode": "manual", "label": {"es": "el Banco Central de Bolivia (tipo de cambio oficial)", "en": "the Central Bank of Bolivia (official rate)"}, "page_url": "https://www.bcb.gob.bo"}'::jsonb,
   2026, 'BO', 'https://www.bcb.gob.bo', '2026-10-30', 'no aplica (tipo de cambio)', 'Sin API. Tipo de cambio oficial vigente al 31-oct-2026: 12,09 Bs por dólar.'),
  ('fx_usd_local', '{"currency": "USD", "mode": "none"}'::jsonb,
   2026, 'EC', 'https://www.bce.fin.ec', '2026-10-30', 'no aplica (tipo de cambio)', 'Ecuador usa el dólar estadounidense: no hay conversión.')
on conflict (key, jurisdiction, year) do update
  set value = excluded.value, source_url = excluded.source_url, verified_at = excluded.verified_at, notes = excluded.notes;
