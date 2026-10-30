import { useTranslation } from 'react-i18next';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { TaxRuleRow } from '@/data/db';
import { formatDateISO } from '@/shared/lib/format';
import { Badge, Sheet, TaxDisclaimer } from '@/shared/ui';

/** Muestra cada regla con su fuente oficial y fecha de verificación (requisito del proyecto). */
export function RulesSheet({ open, onClose, rules }: { open: boolean; onClose: () => void; rules: TaxRuleRow[] }) {
  const { t, i18n } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('settings.sourcesTitle')} description={t('settings.sourcesBody')}>
      <div className="flex flex-col gap-3 pb-2">
        <TaxDisclaimer />
        {rules.map((r) => {
          const host = safeHost(r.sourceUrl);
          const summary = summarize(r, t);
          return (
            <div key={r.id} className="rounded-2xl bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold leading-snug text-ink">{t(`rules.${r.key}_${r.jurisdiction}`, { defaultValue: t(`rules.${r.key}`, { defaultValue: r.key }) })}</h3>
                <Badge tone="neutral">
                  {r.jurisdiction === 'federal' ? t('rules.jurisdiction_federal') : r.jurisdiction} · {r.year}
                </Badge>
              </div>
              {summary && <p className="tnum mt-1.5 text-[14px] font-medium text-ink-2">{summary}</p>}
              <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
                {t('common.source')}: {host} <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
                <span>{t('common.verifiedOn', { date: formatDateISO(r.verifiedAt, i18n.language) })}</span>
                {r.reviewedBy && (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t('settings.reviewedBy', { who: r.reviewedBy })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function summarize(r: TaxRuleRow, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  const v = r.value as Record<string, unknown>;
  if (typeof v.threshold_hours === 'number' && typeof v.multiplier === 'number') return `${v.threshold_hours} h · ${v.multiplier}x`;
  if (typeof v.flsa_section === 'string') return `FLSA ${v.flsa_section}`;
  if (typeof v.calendar_years_limit === 'number') return `${t('rules.sumYears', { n: v.calendar_years_limit })} · ${String(v.edition ?? '')}`;
  if (typeof v.max_prior_years === 'number') return `${t('rules.sumPrior', { n: v.max_prior_years, w: v.preceding_years_window })} · ${String(v.edition ?? '')}`;
  if (Array.isArray(v.visa_classes)) return `${(v.visa_classes as string[]).join(', ')} · ${String(v.edition ?? '')}`;
  if (typeof v.edition === 'string') return v.edition;
  return null;
}
