-- =====================================================================
-- Límites anti-abuso para lo que se puede enviar sin cuenta (comentarios, encuesta,
-- métricas y suscripciones a notificaciones). La app funciona sin cuenta, así que estas
-- tablas aceptan inserts anónimos; el límite evita que alguien las llene con basura
-- (el plan gratis de Supabase tiene 500 MB).
-- Dos topes por hora: por install_id (un celular) y total de la tabla.
-- =====================================================================

create or replace function public.enforce_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  per_install int := tg_argv[0]::int;
  per_table int := tg_argv[1]::int;
  n_install int;
  n_table int;
begin
  execute format('select count(*) from public.%I where install_id = $1 and created_at > now() - interval ''1 hour''', tg_table_name)
    into n_install using new.install_id;
  if n_install >= per_install then
    raise exception 'rate_limit' using errcode = 'P0001', hint = 'Too many inserts from this install in the last hour';
  end if;
  execute format('select count(*) from public.%I where created_at > now() - interval ''1 hour''', tg_table_name)
    into n_table;
  if n_table >= per_table then
    raise exception 'rate_limit' using errcode = 'P0001', hint = 'Too many inserts in the last hour';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_insert_rate_limit() from public, anon, authenticated;

comment on function public.enforce_insert_rate_limit() is 'Trigger: tope de inserts por hora por install_id (arg 0) y por tabla (arg 1).';

create index if not exists feedback_install_created_idx on public.feedback (install_id, created_at);
create index if not exists feedback_created_idx on public.feedback (created_at);
create index if not exists survey_install_created_idx on public.survey_responses (install_id, created_at);
create index if not exists survey_created_idx on public.survey_responses (created_at);
create index if not exists events_install_created_idx on public.events (install_id, created_at);
create index if not exists events_created_idx on public.events (created_at);
create index if not exists push_install_created_idx on public.push_subscriptions (install_id, created_at);

create trigger feedback_rate_limit before insert on public.feedback
  for each row execute function public.enforce_insert_rate_limit('10', '300');

create trigger survey_rate_limit before insert on public.survey_responses
  for each row execute function public.enforce_insert_rate_limit('5', '300');

create trigger events_rate_limit before insert on public.events
  for each row execute function public.enforce_insert_rate_limit('300', '30000');

create trigger push_rate_limit before insert on public.push_subscriptions
  for each row execute function public.enforce_insert_rate_limit('10', '500');
