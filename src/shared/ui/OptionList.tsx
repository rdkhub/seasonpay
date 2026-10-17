import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}

interface OptionListProps<T extends string> {
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
}

/** Lista de opciones grandes con check (onboarding, selección de empleador). */
export function OptionList<T extends string>({ options, value, onChange, ariaLabel }: OptionListProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-col gap-2.5">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              tap();
              onChange(o.value);
            }}
            style={{ animationDelay: `${i * 35}ms` }}
            className={cn(
              'flex min-h-[64px] w-full animate-rise-in items-center gap-3.5 rounded-2xl px-4 py-3 text-left ring-1 transition-all duration-150 ease-out active:scale-[0.985]',
              active ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface ring-line shadow-card',
            )}
          >
            {o.icon && <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg', active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2')}>{o.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-ink">{o.label}</span>
              {o.description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{o.description}</span>}
            </span>
            <span
              aria-hidden
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full transition-all duration-150',
                active ? 'scale-100 bg-accent text-accent-ink' : 'scale-90 ring-2 ring-line',
              )}
            >
              {active && <Check className="h-4 w-4" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
