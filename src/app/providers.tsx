import { useEffect, type ReactNode } from 'react';
import { useProfile } from '@/data/hooks';
import { startAutoSync } from '@/data/sync/syncEngine';
import { applyLanguagePref } from '@/shared/i18n';
import { ToastProvider } from '@/shared/ui';

/** Mantiene el idioma igual a la preferencia guardada en el perfil. */
function LanguageSync() {
  const profile = useProfile();
  useEffect(() => {
    if (profile) void applyLanguagePref(profile.language);
  }, [profile]);
  return null;
}

/** Sincronización con Supabase. No hace nada hasta la Fase 4 (sin variables o sin sesión). */
function SyncRunner() {
  useEffect(() => startAutoSync(), []);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <LanguageSync />
      <SyncRunner />
      {children}
    </ToastProvider>
  );
}
