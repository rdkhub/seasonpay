-- =====================================================================
-- Cuentas con usuario y contraseña (sin correo).
-- La Edge Function create-user anota cada intento para limitar a 5 cuentas por IP por hora.
-- Solo guarda un hash de la IP y se limpia a las 24 h. Sin políticas: solo la usa service_role.
-- =====================================================================

create table if not exists public.signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null check (length(ip_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_created_idx on public.signup_attempts (ip_hash, created_at);

alter table public.signup_attempts enable row level security;

revoke all on public.signup_attempts from anon, authenticated;

comment on table public.signup_attempts is 'Intentos de crear cuenta (hash de IP). Límite anti-abuso de create-user. Se borra a las 24 h.';
