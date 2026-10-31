import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LandingScreen } from '@/features/landing/LandingScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { TodayScreen } from '@/features/shifts/TodayScreen';
import { AppLayout } from './AppLayout';
import { RootGate } from './RootGate';

/*
 * Las pantallas de entrada (inicio, bienvenida y Hoy) van en el paquete principal.
 * El resto se carga al abrirlas: la página pública abre más rápido. Sin señal no cambia nada,
 * porque el service worker guarda todos los archivos de la app al instalarse.
 */
export const router = createBrowserRouter([
  {
    element: <RootGate />,
    children: [
      { path: '/hola', element: <LandingScreen /> },
      { path: '/welcome', element: <OnboardingScreen /> },
      { path: '/privacidad', lazy: () => import('@/features/privacy/PrivacyScreen').then((m) => ({ Component: m.PrivacyScreen })) },
      { path: '/privacy', lazy: () => import('@/features/privacy/PrivacyScreen').then((m) => ({ Component: m.PrivacyScreen })) },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <TodayScreen /> },
          { path: 'week', lazy: () => import('@/features/week/WeekScreen').then((m) => ({ Component: m.WeekScreen })) },
          { path: 'paystubs', lazy: () => import('@/features/paystubs/PaystubsScreen').then((m) => ({ Component: m.PaystubsScreen })) },
          { path: 'season', lazy: () => import('@/features/season/SeasonScreen').then((m) => ({ Component: m.SeasonScreen })) },
          { path: 'season/send', lazy: () => import('@/features/remit/RemitScreen').then((m) => ({ Component: m.RemitScreen })) },
          { path: 'settings', lazy: () => import('@/features/settings/SettingsScreen').then((m) => ({ Component: m.SettingsScreen })) },
          { path: 'admin', lazy: () => import('@/features/admin/AdminScreen').then((m) => ({ Component: m.AdminScreen })) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
