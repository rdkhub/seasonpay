import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/inter';
import './index.css';
import './shared/i18n';
import { App } from './app/App';
import { ensureRulesSeeded } from './data/repos/rules';
import { listenForInstallPrompt } from './shared/lib/installPrompt';
import { getSupabase } from './data/sync/supabaseClient';

// Reglas oficiales incluidas en la app (para que todo funcione sin internet).
void ensureRulesSeeded();

listenForInstallPrompt();

// Service worker: cachea la app para abrirla sin señal y se actualiza solo.
if ('serviceWorker' in navigator) registerSW({ immediate: true });

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

// Si llegamos desde el enlace del correo, Supabase lee el token de la URL antes de que
// el router redirija y lo borre.
const fromEmailLink = /access_token=|error_description=/.test(window.location.hash) || /[?&]code=/.test(window.location.search);
const sb = fromEmailLink ? getSupabase() : null;
if (sb) void sb.then((c) => c.auth.getSession()).finally(render);
else render();
