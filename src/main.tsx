import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/inter';
import './index.css';
import './shared/i18n';
import { App } from './app/App';
import { ensureRulesSeeded } from './data/repos/rules';

// Reglas oficiales incluidas en la app (para que todo funcione sin internet).
void ensureRulesSeeded();

// Service worker: cachea la app para abrirla sin señal y se actualiza solo.
if ('serviceWorker' in navigator) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
