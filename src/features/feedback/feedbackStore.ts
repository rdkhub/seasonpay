import { useSyncExternalStore } from 'react';

/**
 * Abre el formulario de feedback desde cualquier pantalla.
 * Antes de abrirlo toma una captura de la pantalla actual de la app (no de la galería):
 * SeasonPay nunca muestra SSN, pasaporte ni datos bancarios, así que la captura no los tiene.
 */
interface State {
  open: boolean;
  screen: string;
  screenshot: string | null;
}

let state: State = { open: false, screen: '/', screenshot: null };
const listeners = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

/** Límite de la columna feedback.screenshot (data URL). */
const MAX_LEN = 650_000;

async function captureScreen(): Promise<string | null> {
  try {
    const { toJpeg } = await import('html-to-image');
    const node = document.getElementById('root') ?? document.body;
    const bg = getComputedStyle(document.body).backgroundColor || '#ffffff';
    for (const [quality, pixelRatio] of [
      [0.7, 1],
      [0.5, 1],
      [0.5, 0.6],
    ] as const) {
      const url = await toJpeg(node, {
        quality,
        pixelRatio,
        backgroundColor: bg,
        width: window.innerWidth,
        height: window.innerHeight,
        style: { transform: `translateY(-${window.scrollY}px)` },
        filter: (el) => !(el instanceof HTMLElement && el.dataset.noCapture !== undefined),
      });
      if (url.length <= MAX_LEN) return url;
    }
  } catch (e) {
    console.warn('[feedback] captura', e);
  }
  return null;
}

export async function openFeedback(): Promise<void> {
  const screen = window.location.pathname || '/';
  const screenshot = await captureScreen();
  set({ open: true, screen, screenshot });
}

export function closeFeedback(): void {
  set({ open: false, screenshot: null });
}

export function useFeedbackState(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
