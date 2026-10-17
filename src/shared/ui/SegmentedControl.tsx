import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
  /** Columnas de la grilla (por defecto, una por opción) */
  columns?: number;
}

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, className, columns }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-1 rounded-2xl bg-surface-2 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
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
            className={cn(
              'h-12 truncate rounded-xl px-2 text-[15px] font-semibold transition-all duration-150 ease-out active:scale-[0.97]',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-2',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
