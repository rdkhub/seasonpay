import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useProfile } from '@/data/hooks';
import { LogoMark } from '@/shared/ui/Logo';
import { shouldShowLanding } from '@/features/landing/landingSeen';

/** Decide si mostrar la bienvenida o la app, según si ya terminó el onboarding. */
export function RootGate() {
  const profile = useProfile();
  const { pathname } = useLocation();

  if (profile === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <LogoMark className="h-16 w-16 animate-fade-in" />
      </div>
    );
  }
  const onboarded = !!profile?.onboardedAt;
  // La página pública (/hola) se puede abrir siempre; el resto depende del onboarding.
  if (pathname === '/hola' || pathname === '/privacidad' || pathname === '/privacy') return <Outlet />;
  if (!onboarded && pathname !== '/welcome') return <Navigate to={shouldShowLanding() ? '/hola' : '/welcome'} replace />;
  if (onboarded && pathname === '/welcome') return <Navigate to="/" replace />;
  return <Outlet />;
}
