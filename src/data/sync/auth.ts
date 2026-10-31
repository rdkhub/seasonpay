import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, hasSupabaseConfig } from './supabaseClient';
import { usernameToEmail } from '@/domain/username';

/**
 * Sesión de Supabase como store simple (sin librerías). La app funciona igual sin sesión:
 * el login solo agrega respaldo en la nube y uso en varios celulares.
 */

export interface AuthState {
  ready: boolean;
  session: Session | null;
}

let state: AuthState = { ready: !hasSupabaseConfig(), session: null };
const listeners = new Set<() => void>();
const set = (s: AuthState) => {
  state = s;
  listeners.forEach((l) => l());
};

let started = false;
/** Lee la sesión guardada y escucha cambios (login, logout, refresh del token). */
export async function initAuth(onSignedIn?: () => void): Promise<void> {
  if (started) return;
  started = true;
  const sb = await getSupabase();
  if (!sb) return set({ ready: true, session: null });
  const { data } = await sb.auth.getSession();
  set({ ready: true, session: data.session });
  sb.auth.onAuthStateChange((event, session) => {
    set({ ready: true, session });
    if (event === 'SIGNED_IN') onSignedIn?.();
  });
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export const authAvailable = hasSupabaseConfig;
export const googleAuthEnabled = () => import.meta.env.VITE_GOOGLE_AUTH === 'true';
/** Entrar con código al correo. Apagado en el piloto (no hay SMTP propio); se prende con VITE_EMAIL_AUTH=true. */
export const emailAuthEnabled = () => import.meta.env.VITE_EMAIL_AUTH === 'true';

export type AuthError = 'rate_limit' | 'invalid_code' | 'network' | 'unknown';

export type PasswordAuthError =
  | 'invalid_credentials'
  | 'username_taken'
  | 'invalid_username'
  | 'weak_password'
  | 'rate_limit'
  | 'network'
  | 'unknown';

/** Crea la cuenta en la Edge Function create-user y entra. */
export async function signUpWithUsername(username: string, password: string): Promise<PasswordAuthError | null> {
  const sb = await getSupabase();
  if (!sb) return 'unknown';
  try {
    const { data, error } = await sb.functions.invoke<{ ok?: boolean; error?: PasswordAuthError }>('create-user', {
      body: { username, password },
    });
    if (error) {
      // FunctionsHttpError trae la respuesta con el código de error
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const b = (await ctx.json().catch(() => null)) as { error?: PasswordAuthError } | null;
        if (b?.error) return b.error;
      }
      return /fetch|network/i.test(error.message) ? 'network' : 'unknown';
    }
    if (!data?.ok) return data?.error ?? 'unknown';
  } catch {
    return 'network';
  }
  return signInWithUsername(username, password);
}

export async function signInWithUsername(username: string, password: string): Promise<PasswordAuthError | null> {
  const sb = await getSupabase();
  if (!sb) return 'unknown';
  try {
    const { error } = await sb.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (!error) return null;
    if (error.status === 429) return 'rate_limit';
    if (error.code === 'invalid_credentials' || error.status === 400) return 'invalid_credentials';
    if (/fetch|network/i.test(error.message)) return 'network';
    return 'unknown';
  } catch {
    return 'network';
  }
}

export async function changePassword(password: string): Promise<PasswordAuthError | null> {
  const sb = await getSupabase();
  if (!sb) return 'unknown';
  try {
    const { error } = await sb.auth.updateUser({ password });
    if (!error) return null;
    if (error.code === 'weak_password' || error.code === 'same_password') return 'weak_password';
    return /fetch|network/i.test(error.message) ? 'network' : 'unknown';
  } catch {
    return 'network';
  }
}

function mapError(e: { status?: number; message?: string; code?: string } | null): AuthError | null {
  if (!e) return null;
  if (e.status === 429 || /rate/i.test(e.message ?? '') || e.code === 'over_email_send_rate_limit') return 'rate_limit';
  if (e.code === 'otp_expired' || /expired|invalid/i.test(e.message ?? '')) return 'invalid_code';
  if (/fetch|network/i.test(e.message ?? '')) return 'network';
  return 'unknown';
}

/** Envía un código de un solo uso al correo (crea la cuenta si no existe). */
export async function sendEmailCode(email: string): Promise<AuthError | null> {
  const sb = await getSupabase();
  if (!sb) return 'unknown';
  try {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin } });
    return mapError(error);
  } catch {
    return 'network';
  }
}

export async function verifyEmailCode(email: string, token: string): Promise<AuthError | null> {
  const sb = await getSupabase();
  if (!sb) return 'unknown';
  try {
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    return mapError(error);
  } catch {
    return 'network';
  }
}

export async function signInWithGoogle(): Promise<void> {
  const sb = await getSupabase();
  await sb?.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
}

export async function signOut(): Promise<void> {
  const sb = await getSupabase();
  await sb?.auth.signOut();
}
