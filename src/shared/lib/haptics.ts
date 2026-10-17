/** Vibración corta al tocar acciones importantes (Android). En iPhone no hace nada. */
export function tap(kind: 'light' | 'success' | 'warning' = 'light'): void {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    const pattern = kind === 'success' ? [12, 40, 18] : kind === 'warning' ? [30] : [8];
    navigator.vibrate(pattern);
  } catch {
    /* sin vibración */
  }
}
