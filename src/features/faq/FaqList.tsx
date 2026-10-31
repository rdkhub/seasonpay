import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Sheet } from '@/shared/ui';

/** Orden de las preguntas. Los textos viven en i18n: faq.items.<id>.q / .a */
export const FAQ_IDS = ['free', 'account', 'data', 'password', 'states', 'countries', 'offline', 'taxes', 'sources', 'install', 'delete', 'who'] as const;

/** Preguntas frecuentes en acordeón (una abierta a la vez). */
export function FaqList({ className, tone = 'card' }: { className?: string; tone?: 'card' | 'plain' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className={cn(tone === 'card' && 'overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-line/70', 'divide-y divide-line/70', className)}>
      {FAQ_IDS.map((id) => {
        const isOpen = open === id;
        return (
          <div key={id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`faq-${id}`}
              onClick={() => setOpen(isOpen ? null : id)}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-surface-2"
            >
              <span className="text-[15px] font-semibold text-ink">{t(`faq.items.${id}.q`)}</span>
              <ChevronDown className={cn('h-5 w-5 shrink-0 text-ink-3 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <p id={`faq-${id}`} className="whitespace-pre-line px-4 pb-4 text-[14px] leading-relaxed text-ink-2">
                {t(`faq.items.${id}.a`)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function FaqSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('faq.title')}>
      <FaqList tone="plain" className="-mx-1 pb-2" />
    </Sheet>
  );
}
