import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  error?: boolean;
}

/** Casilla con texto. Toda la fila se puede tocar (mínimo 44 px de alto). */
export function Checkbox({ checked, onChange, children, error }: Props) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5">
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => {
          tap();
          onChange(e.target.checked);
        }}
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ring-2 transition-colors peer-focus-visible:ring-accent',
          checked ? 'bg-accent text-accent-ink ring-accent' : error ? 'ring-danger' : 'ring-line',
        )}
      >
        {checked && <Check className="h-4 w-4" strokeWidth={3} />}
      </span>
      <span className="text-[14px] leading-snug text-ink-2">{children}</span>
    </label>
  );
}
