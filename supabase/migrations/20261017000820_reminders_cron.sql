-- Recordatorios diarios por notificación.
-- 1) Secreto para que solo pg_cron pueda llamar a la Edge Function (se genera aquí, nadie lo ve).
-- 2) Primera llamada ('init'): la función crea las llaves VAPID y publica la llave pública en app_config.
-- 3) Cron diario a las 16:00 UTC (9:00 en Montana en invierno).
create extension if not exists pg_net;
create extension if not exists pg_cron;

select public.internal_set_secret('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
where not exists (select 1 from vault.secrets where name = 'cron_secret');

select net.http_post(
  url := 'https://qjmtgrxyjtomirzhdvdq.supabase.co/functions/v1/send-reminders',
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.internal_get_secret('cron_secret')),
  body := '{"action":"init"}'::jsonb
);

select cron.schedule(
  'seasonpay-reminders',
  '0 16 * * *',
  $cron$
  select net.http_post(
    url := 'https://qjmtgrxyjtomirzhdvdq.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.internal_get_secret('cron_secret')),
    body := '{}'::jsonb
  );
  $cron$
);
