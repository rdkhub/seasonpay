import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Interruptor. Toda la fila es tocable, no solo el switch. */
export function Toggle({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  const id = useId();
  const sw = (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute left-1 h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-200 ease-out',
          checked && 'translate-x-5',
        )}
      />
    </span>
  );
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? `${id}-l` : undefined}
      disabled={disabled}
      onClick={() => {
        tap();
        onChange(!checked);
      }}
      className={cn(
        'flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl text-left transition-opacity disabled:opacity-40',
        className,
      )}
    >
      {(label || description) && (
        <span className="min-w-0">
          {label && (
            <span id={`${id}-l`} className="block text-[16px] font-medium text-ink">
              {label}
            </span>
          )}
          {description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{description}</span>}
        </span>
      )}
      {sw}
    </button>
  );
}
