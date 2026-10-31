import { db } from '../db';

/**
 * Interruptores públicos (tabla app_config). Se bajan con la sincronización, aun sin sesión.
 * Sin señal o sin datos, se usan estos valores por defecto (los más conservadores).
 */
export interface AppConfig {
  referralsEnabled: boolean;
  whatsappGroupUrl: string | null;
  privacyPolicyVersion: string;
  vapidPublicKey: string | null;
}

/** Versión de la política incluida en la app. Debe coincidir con app_config.privacy_policy_version. */
export const BUNDLED_POLICY_VERSION = '2026-10-30';

export const DEFAULT_CONFIG: AppConfig = {
  referralsEnabled: false,
  whatsappGroupUrl: null,
  privacyPolicyVersion: BUNDLED_POLICY_VERSION,
  vapidPublicKey: null,
};

const https = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null);

export function parseConfig(rows: { key: string; value: unknown }[]): AppConfig {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    referralsEnabled: m.get('referrals_enabled') === true,
    whatsappGroupUrl: https(m.get('whatsapp_group_url')),
    privacyPolicyVersion: typeof m.get('privacy_policy_version') === 'string' ? (m.get('privacy_policy_version') as string) : BUNDLED_POLICY_VERSION,
    vapidPublicKey: typeof m.get('vapid_public_key') === 'string' ? (m.get('vapid_public_key') as string) : null,
  };
}

export async function getConfig(): Promise<AppConfig> {
  return parseConfig(await db.appConfig.toArray());
}
