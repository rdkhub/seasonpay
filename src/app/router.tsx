import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LandingScreen } from '@/features/landing/LandingScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { PaystubsScreen } from '@/features/paystubs/PaystubsScreen';
import { RemitScreen } from '@/features/remit/RemitScreen';
import { PrivacyScreen } from '@/features/privacy/PrivacyScreen';
import { AdminScreen } from '@/features/admin/AdminScreen';
import { SeasonScreen } from '@/features/season/SeasonScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { TodayScreen } from '@/features/shifts/TodayScreen';
import { WeekScreen } from '@/features/week/WeekScreen';
import { AppLayout } from './AppLayout';
import { RootGate } from './RootGate';

export const router = createBrowserRouter([
  {
    element: <RootGate />,
    children: [
      { path: '/hola', element: <LandingScreen /> },
      { path: '/welcome', element: <OnboardingScreen /> },
      { path: '/privacidad', element: <PrivacyScreen /> },
      { path: '/privacy', element: <PrivacyScreen /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <TodayScreen /> },
          { path: 'week', element: <WeekScreen /> },
          { path: 'paystubs', element: <PaystubsScreen /> },
          { path: 'season', element: <SeasonScreen /> },
          { path: 'season/send', element: <RemitScreen /> },
          { path: 'settings', element: <SettingsScreen /> },
          { path: 'admin', element: <AdminScreen /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
