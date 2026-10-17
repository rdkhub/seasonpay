import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface EmptyStateProps {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-9 text-center', className)}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent [&>svg]:h-7 [&>svg]:w-7">{icon}</div>
      <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-[30ch] text-[15px] leading-snug text-ink-2">{body}</p>}
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
    </div>
  );
}
