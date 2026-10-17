import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  tone?: 'default' | 'sunken' | 'hero';
}

const tones = {
  default: 'bg-surface shadow-card ring-1 ring-line/70',
  sunken: 'bg-surface-2',
  hero: 'hero-card text-white shadow-lift',
};

export function Card({ padded = true, tone = 'default', className, ...rest }: CardProps) {
  return <div className={cn('rounded-3xl', tones[tone], padded && 'p-5', className)} {...rest} />;
}

interface PressableCardProps extends HTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  disabled?: boolean;
}

/** Tarjeta tocable (filas de turnos, empleadores). */
export function PressableCard({ className, onClick, disabled, ...rest }: PressableCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        tap();
        onClick?.(e);
      }}
      className={cn(
        'w-full rounded-3xl bg-surface p-4 text-left shadow-card ring-1 ring-line/70',
        'transition-transform duration-150 ease-out active:scale-[0.985]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30',
        className,
      )}
      {...rest}
    />
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-center justify-between px-1 first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{children}</h2>
      {action}
    </div>
  );
}
