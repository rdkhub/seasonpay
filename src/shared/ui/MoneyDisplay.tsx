import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { splitMoney } from '@/shared/lib/format';

type Size = 'display' | 'hero' | 'lg' | 'md' | 'sm';

const sizes: Record<Size, string> = {
  display: 'text-display',
  hero: 'text-hero',
  lg: 'text-[28px] leading-none font-semibold tracking-[-0.025em]',
  md: 'text-xl leading-none font-semibold tracking-[-0.02em]',
  sm: 'text-[17px] leading-none font-semibold',
};

interface MoneyDisplayProps {
  cents: number;
  size?: Size;
  /** Centavos más chicos y suaves, como en apps de banca */
  dimCents?: boolean;
  className?: string;
  label?: string;
}

/** Monto en dólares con cifras tabulares. Los centavos van más chicos para que el monto se lea rápido. */
export function MoneyDisplay({ cents, size = 'md', dimCents = true, className, label }: MoneyDisplayProps) {
  const { i18n } = useTranslation();
  const { whole, fraction } = splitMoney(cents, i18n.language);
  return (
    <span className={cn('tnum inline-flex items-baseline whitespace-nowrap', sizes[size], className)} aria-label={label}>
      <span>{whole}</span>
      {fraction && <span className={cn(dimCents && 'text-[0.55em] font-semibold opacity-60', 'ml-[1px]')}>{fraction}</span>}
    </span>
  );
}
