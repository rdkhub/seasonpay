import { useEffect, type ReactNode } from 'react';
import { useProfile } from '@/data/hooks';
import { initAuth } from '@/data/sync/auth';
import { startAutoSync, syncNow } from '@/data/sync/syncEngine';
import { db } from '@/data/db';
import { track, trackAppOpen } from '@/data/telemetry';
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
    void initAuth(async () => {
      // "account_created": la primera vez que este celular entra a una cuenta.
      if (!(await db.meta.get('accountTracked'))) {
        await db.meta.put({ key: 'accountTracked', value: true });
        await track('account_created');
      }
      void syncNow();
    });
    void trackAppOpen();
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
