-- Solo lectura para la app: nadie escribe en remit_providers salvo service_role.
revoke insert, update, delete on public.remit_providers from anon, authenticated;
