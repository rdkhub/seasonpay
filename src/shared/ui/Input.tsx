import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}

export function FieldShell({ label, hint, error, htmlFor, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="px-1 text-sm font-medium text-ink-2">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="px-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="px-1 text-[13px] leading-snug text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

const boxClass = (invalid: boolean) =>
  cn(
    'flex h-14 items-center gap-2 rounded-2xl bg-surface-2 px-4 ring-1 transition-shadow duration-150',
    invalid ? 'ring-danger' : 'ring-transparent focus-within:ring-2 focus-within:ring-accent',
  );

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  numeric?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, prefix, suffix, numeric, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <div className={boxClass(!!error)}>
        {prefix && <span className="text-lg text-ink-3">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-3',
            numeric && 'tnum font-medium',
          )}
          {...rest}
        />
        {suffix && <span className="shrink-0 text-[15px] text-ink-3">{suffix}</span>}
      </div>
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={selectId} className={className}>
      <div className={cn(boxClass(!!error), 'relative pr-11')}>
        <select
          ref={ref}
          id={selectId}
          className="h-full min-w-0 flex-1 appearance-none bg-transparent text-[17px] text-ink outline-none"
          {...rest}
        >
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-4 h-5 w-5 text-ink-3" />
      </div>
    </FieldShell>
  );
});
