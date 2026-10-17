import { createBrowserRouter, Navigate } from 'react-router-dom';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { TodayScreen } from '@/features/shifts/TodayScreen';
import { WeekScreen } from '@/features/week/WeekScreen';
import { AppLayout } from './AppLayout';
import { RootGate } from './RootGate';

export const router = createBrowserRouter([
  {
    element: <RootGate />,
    children: [
      { path: '/welcome', element: <OnboardingScreen /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <TodayScreen /> },
          { path: 'week', element: <WeekScreen /> },
          { path: 'settings', element: <SettingsScreen /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
