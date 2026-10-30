-- Los ahorros pueden guardar el tipo de cambio de SUNAT (respaldo cuando el BCRP no responde).
alter table public.savings drop constraint if exists savings_fx_source_check;
alter table public.savings add constraint savings_fx_source_check check (fx_source in ('bcrp', 'sunat', 'manual'));
