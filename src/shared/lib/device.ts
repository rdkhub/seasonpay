/**
 * Datos del dispositivo que se adjuntan al feedback y a las métricas.
 * Solo categorías generales (sistema y versión mayor), nunca identificadores del equipo.
 */

export type Platform = 'ios' | 'android' | 'desktop' | 'other';

export function detectPlatform(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'other';
}

/** "iOS 17.4", "Android 14", "Windows", "macOS"… */
export function osLabel(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const ios = ua.match(/OS (\d+)[_.](\d+)/);
  if (/iPhone|iPad|iPod/i.test(ua) && ios) return `iOS ${ios[1]}.${ios[2]}`;
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  if (android) return `Android ${android[1]}`;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh/i.test(ua)) return 'macOS';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Otro';
}

/** iOS 16.4 o más nuevo: requisito para notificaciones web (solo con la app instalada). */
export function iosSupportsWebPush(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean | null {
  const m = ua.match(/OS (\d+)[_.](\d+)/);
  if (!/iPhone|iPad|iPod/i.test(ua) || !m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return major > 16 || (major === 16 && minor >= 4);
}

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
