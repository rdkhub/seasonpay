import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';

interface ListRowProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  tone?: 'default' | 'danger';
  href?: string;
}

/** Fila de lista dentro de una Card agrupada (ajustes). */
export function ListRow({ icon, title, subtitle, trailing, onClick, chevron = !!onClick, tone = 'default', href }: ListRowProps) {
  const content = (
    <>
      {icon && (
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl [&>svg]:h-5 [&>svg]:w-5',
            tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink-2',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[16px] font-medium', tone === 'danger' ? 'text-danger' : 'text-ink')}>{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[13px] text-ink-3">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-[15px] text-ink-2">{trailing}</span>}
      {chevron && <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-ink-3" />}
    </>
  );
  const cls = 'flex min-h-[64px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors active:bg-surface-2';
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {content}
      </a>
    );
  if (onClick)
    return (
      <button
        type="button"
        className={cls}
        onClick={() => {
          tap();
          onClick();
        }}
      >
        {content}
      </button>
    );
  return <div className={cls}>{content}</div>;
}

export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-line/70 overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-line/70', className)}>{children}</div>;
}
