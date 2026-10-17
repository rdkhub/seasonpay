import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft' | 'ink';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  haptic?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink shadow-accent hover:brightness-[1.04]',
  secondary: 'bg-surface text-ink shadow-card ring-1 ring-line hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white shadow-card hover:brightness-[1.05]',
  'danger-soft': 'bg-danger-soft text-danger hover:brightness-[0.98]',
  ink: 'bg-ink text-bg shadow-lift hover:opacity-95',
};

// Tamaños pensados para dedos con guantes: el mínimo es 48 px de alto.
const sizes: Record<ButtonSize, string> = {
  sm: 'h-12 px-4 text-[15px] rounded-xl',
  md: 'h-14 px-5 text-base rounded-2xl',
  lg: 'h-16 px-4 text-[17px] rounded-2xl',
  xl: 'h-[76px] px-7 text-lg rounded-3xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, icon, trailingIcon, loading, haptic = true, className, children, onClick, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={(e) => {
        if (haptic) tap();
        onClick?.(e);
      }}
      className={cn(
        'relative inline-flex select-none items-center justify-center gap-2.5 whitespace-nowrap font-semibold tracking-[-0.01em]',
        'transition-[transform,background-color,box-shadow,opacity,filter] duration-150 ease-out active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {trailingIcon}
    </button>
  );
});

function Spinner() {
  return <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}
