import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/** Aviso fijo de las pantallas de impuestos: estimaciones informativas, no asesoría. */
export function TaxDisclaimer({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p role="note" className={cn('flex gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-[13px] leading-snug text-ink-2', className)}>
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
      <span>
        <strong className="font-semibold text-ink">{t('tax.disclaimerTitle')}</strong> {t('tax.disclaimerBody')}
      </span>
    </p>
  );
}
