import { detectPlatform, iosSupportsWebPush } from '@/shared/lib/device';
import { isStandalone } from '@/shared/lib/installPrompt';

export const INSTALL_DISMISSED_KEY = 'seasonpay.installDismissed';

export type InstallCase = 'installed' | 'ios_safari' | 'ios_other_browser' | 'android' | 'desktop';

export function installCase(ua = navigator.userAgent): InstallCase {
  if (isStandalone()) return 'installed';
  const p = detectPlatform(ua);
  if (p === 'ios') return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'ios_other_browser' : 'ios_safari';
  if (p === 'android') return 'android';
  return 'desktop';
}

/** Mostrar la tarjeta de instalación en Hoy: no instalada, celular, y no la cerró antes. */
export function shouldOfferInstall(): boolean {
  const c = installCase();
  if (c === 'installed' || c === 'desktop') return false;
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) !== '1';
  } catch {
    return true;
  }
}

export function dismissInstallOffer(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch {
    /* almacenamiento bloqueado */
  }
}

export { iosSupportsWebPush };
