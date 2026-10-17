import { CalendarRange, Receipt, Settings2, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';

interface Item {
  to: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

export function BottomNav() {
  const { t } = useTranslation();
  const items: Item[] = [
    { to: '/', label: t('nav.today'), icon: <Timer /> },
    { to: '/week', label: t('nav.week'), icon: <CalendarRange /> },
    { to: '/paystubs', label: t('nav.paystubs'), icon: <Receipt />, disabled: true },
    { to: '/settings', label: t('nav.settings'), icon: <Settings2 /> },
  ];

  const itemClass = 'flex h-[64px] flex-col items-center justify-center gap-1 rounded-2xl text-[12px] font-semibold transition-colors';

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-1.5">
        {items.map((it) => (
          <li key={it.to}>
            {it.disabled ? (
              <span aria-disabled className={cn(itemClass, 'relative cursor-not-allowed text-ink-3/60')}>
                <span className="[&>svg]:h-6 [&>svg]:w-6">{it.icon}</span>
                {it.label}
                <span className="absolute right-[18%] top-1.5 rounded-full bg-surface-2 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-ink-3">
                  {t('common.soon')}
                </span>
              </span>
            ) : (
              <NavLink
                to={it.to}
                end={it.to === '/'}
                onClick={() => tap()}
                className={({ isActive }) => cn(itemClass, isActive ? 'text-accent' : 'text-ink-3 active:text-ink-2')}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'grid h-8 w-14 place-items-center rounded-full transition-all duration-200 ease-out [&>svg]:h-6 [&>svg]:w-6',
                        isActive ? 'bg-accent-soft' : 'bg-transparent',
                      )}
                    >
                      {it.icon}
                    </span>
                    {it.label}
                  </>
                )}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
