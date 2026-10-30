import { getInstallId } from './install';
import { getConfig } from './repos/config';
import { getSupabase } from './sync/supabaseClient';
import { track } from './telemetry';
import { isStandalone } from '@/shared/lib/installPrompt';
import { detectPlatform, iosSupportsWebPush } from '@/shared/lib/device';

/**
 * Recordatorios por notificación (Web Push).
 * En iPhone solo funcionan con la app instalada en la pantalla de inicio y iOS 16.4 o más.
 * La suscripción se guarda en Supabase por RPC (sin cuenta, por install_id).
 */

export type PushSupport = 'ok' | 'unsupported' | 'ios_needs_install' | 'ios_too_old' | 'not_configured';

export async function pushSupport(): Promise<PushSupport> {
  if (detectPlatform() === 'ios') {
    if (iosSupportsWebPush() === false) return 'ios_too_old';
    if (!isStandalone()) return 'ios_needs_install';
  }
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const cfg = await getConfig();
  if (!cfg.vapidPublicKey || !(await getSupabase())) return 'not_configured';
  return 'ok';
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export type EnableResult = 'enabled' | 'denied' | 'error' | PushSupport;

export async function enableReminders(lang: string): Promise<EnableResult> {
  const support = await pushSupport();
  if (support !== 'ok') return support;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  try {
    const cfg = await getConfig();
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey!) }));
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const sb = (await getSupabase())!;
    const { error } = await sb.rpc('save_push_subscription', {
      p_install: await getInstallId(),
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_lang: lang.startsWith('en') ? 'en' : 'es',
    });
    if (error) throw error;
    await track('push_enabled');
    return 'enabled';
  } catch (e) {
    console.warn('[push]', e);
    return 'error';
  }
}

export async function disableReminders(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const sb = await getSupabase();
  await sb?.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}
