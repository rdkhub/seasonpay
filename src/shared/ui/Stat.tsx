import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  className?: string;
}

/** Dato secundario en una grilla (horas, propinas). */
export function Stat({ label, value, sub, accent, className }: StatProps) {
  return (
    <div className={cn('rounded-3xl bg-surface p-4 shadow-card ring-1 ring-line/70', className)}>
      <div className="text-[13px] font-medium text-ink-3">{label}</div>
      <div className={cn('tnum mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]', accent ? 'text-accent' : 'text-ink')}>{value}</div>
      {sub && <div className="tnum mt-1.5 text-[13px] text-ink-3">{sub}</div>}
    </div>
  );
}
