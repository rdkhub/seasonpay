import { useEffect, type ReactNode } from 'react';
import { useProfile } from '@/data/hooks';
import { initAuth } from '@/data/sync/auth';
import { startAutoSync, syncNow } from '@/data/sync/syncEngine';
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

/** Sesión y sincronización con Supabase. Sin sesión solo baja reglas oficiales actualizadas. */
function SyncRunner() {
  useEffect(() => {
    void initAuth(() => void syncNow());
    return startAutoSync();
  }, []);
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
