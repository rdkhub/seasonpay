import { useEffect, useState } from 'react';

/** Reloj que se actualiza cada `intervalMs`. Se pausa si la pestaña no está visible. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    let id: number | undefined;
    const tick = () => setNow(Date.now());
    const start = () => {
      tick();
      id = window.setInterval(tick, intervalMs);
    };
    const stop = () => window.clearInterval(id);
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs, enabled]);
  return now;
}
