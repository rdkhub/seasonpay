import { Minus, Plus } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { tap } from '@/shared/lib/haptics';
import { FieldShell } from './Input';

interface StepperProps {
  label?: ReactNode;
  hint?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}

/** Selector numérico con botones grandes (descanso en minutos, año de llegada). */
export function Stepper({ label, hint, value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, format }: StepperProps) {
  const id = useId();
  const set = (v: number) => {
    tap();
    onChange(Math.min(max, Math.max(min, v)));
  };
  const btn =
    'grid h-12 w-12 place-items-center rounded-xl bg-surface text-ink shadow-card ring-1 ring-line transition active:scale-95 disabled:opacity-30';
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      <div className="flex h-14 items-center justify-between rounded-2xl bg-surface-2 px-1.5">
        <button type="button" className={btn} onClick={() => set(value - step)} disabled={value <= min} aria-label="−">
          <Minus className="h-5 w-5" />
        </button>
        <output id={id} className="tnum text-[19px] font-semibold text-ink" aria-live="polite">
          {format ? format(value) : value}
        </output>
        <button type="button" className={btn} onClick={() => set(value + step)} disabled={value >= max} aria-label="+">
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </FieldShell>
  );
}
