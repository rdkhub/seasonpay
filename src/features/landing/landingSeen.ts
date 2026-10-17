import { isStandalone } from '@/shared/lib/installPrompt';

export const LANDING_SEEN_KEY = 'seasonpay.landingSeen';

/** La página pública se muestra solo en el navegador y solo hasta que la persona toca "Empezar". */
export function shouldShowLanding(): boolean {
  if (isStandalone()) return false;
  try {
    return localStorage.getItem(LANDING_SEEN_KEY) !== '1';
  } catch {
    return false;
  }
}
