/**
 * Cuentas con usuario y contraseña (sin correo).
 * Supabase Auth necesita un correo por dentro, así que cada usuario se guarda como
 * `<usuario>@<USERNAME_EMAIL_DOMAIN>`. Ese correo es interno: nunca se envía nada ahí
 * (la cuenta la crea la Edge Function `create-user` ya confirmada) y la app no lo muestra.
 * El mismo dominio está en supabase/functions/create-user/index.ts.
 */
export const USERNAME_EMAIL_DOMAIN = 'users.seasonpay.vercel.app';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '');
}

export type UsernameProblem = 'short' | 'long' | 'chars' | null;

export function usernameProblem(u: string): UsernameProblem {
  if (u.length < USERNAME_MIN) return 'short';
  if (u.length > USERNAME_MAX) return 'long';
  if (!USERNAME_RE.test(u) || /[._]{2}/.test(u)) return 'chars';
  return null;
}

export function passwordOk(p: string): boolean {
  return p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX;
}

export function usernameToEmail(u: string): string {
  return `${u}@${USERNAME_EMAIL_DOMAIN}`;
}

/** Devuelve el usuario si la cuenta es de usuario y contraseña; si no, null. */
export function usernameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const suffix = `@${USERNAME_EMAIL_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
}
