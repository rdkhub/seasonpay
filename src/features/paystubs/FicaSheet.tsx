import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { FicaAssessment } from '@/domain';
import type { TaxRuleRow } from '@/data/db';
import { saveProfile } from '@/data/repos/profile';
import { formatDateISO, formatMoney } from '@/shared/lib/format';
import { Button, Sheet, Stepper, useToast } from '@/shared/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  assessment: FicaAssessment & { priorYears: number | null };
  rules: TaxRuleRow[];
}

/** Detalle de FICA: condiciones de la fuente, años en estatus y pasos de reembolso. Todo sale de tax_rules. */
export function FicaSheet({ open, onClose, assessment: a, rules }: Props) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [years, setYears] = useState(0);

  useEffect(() => {
    if (open) setYears(a.priorYears ?? 0);
  }, [open, a.priorYears]);

  const rule = (key: string) => rules.filter((r) => r.key === key && r.jurisdiction === 'federal').sort((x, y) => y.year - x.year)[0];
  const exemption = rule('fica_exemption_nonresident_fjmq');
  const refund = rule('fica_refund_procedure');
  const refundValue = refund?.value as { attachments?: string[]; mail_to?: string; form_843_url?: string; form_8316_url?: string } | undefined;

  const saveYears = async () => {
    await saveProfile({ fjPriorYears: years });
    toast(t('fica.savedYears'));
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('fica.sheetTitle')} description={t(`fica.${a.status}`)}>
      <div className="flex flex-col gap-6 pb-2">
        <p className="text-[15px] leading-relaxed text-ink-2">{t(`fica.${a.status}Body`, { year: a.yearInStatus ?? '—' })}</p>

        <div className="flex flex-col gap-3">
          <Stepper
            label={t('fica.priorYears')}
            hint={t('fica.priorYearsHint')}
            value={years}
            onChange={setYears}
            min={0}
            max={30}
            format={(v) => t('fica.priorYearsFormat', { count: v })}
          />
          {years !== a.priorYears && (
            <Button variant="secondary" onClick={saveYears}>
              {t('common.save')}
            </Button>
          )}
        </div>

        {exemption && (
          <section className="rounded-2xl bg-surface-2 p-4">
            <h3 className="text-[15px] font-semibold text-ink">{t('fica.conditionsTitle')}</h3>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-snug text-ink-2">
              <li>{t('fica.condNonresident')}</li>
              <li>{t('fica.condPurpose')}</li>
              <li>{t('fica.condSponsor')}</li>
              <li>{t('fica.condDependents')}</li>
            </ul>
            <SourceLine url={exemption.sourceUrl} label={t('fica.pub519')} verifiedAt={exemption.verifiedAt} lang={i18n.language} reviewedBy={exemption.reviewedBy} />
          </section>
        )}

        {refundValue && (
          <section>
            <h3 className="mb-3 text-[17px] font-semibold tracking-[-0.01em] text-ink">{t('fica.refundTitle')}</h3>
            {a.withheldCents > 0 && <p className="mb-3 text-[14px] font-medium text-ink">{t('fica.withheld', { amount: formatMoney(a.withheldCents, i18n.language) })}</p>}
            <ol className="flex flex-col gap-4">
              <Step n={1} title={t('fica.step1Title')}>
                {t('fica.step1Body')}
              </Step>
              <Step n={2} title={t('fica.step2Title')}>
                {t('fica.step2Body')}
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                  {(refundValue.attachments ?? []).map((k) => (
                    <li key={k}>{t(`fica.att.${k}`, { defaultValue: k })}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {refundValue.form_843_url && <Ext href={refundValue.form_843_url}>{t('fica.form843')}</Ext>}
                  {refundValue.form_8316_url && <Ext href={refundValue.form_8316_url}>{t('fica.form8316')}</Ext>}
                </div>
              </Step>
              {refundValue.mail_to && (
                <Step n={3} title={t('fica.step3Title')}>
                  {t('fica.mailTo')}
                  <span className="mt-1 block font-medium text-ink">{refundValue.mail_to}</span>
                </Step>
              )}
            </ol>
            {refund && <SourceLine url={refund.sourceUrl} label={t('fica.pub519')} verifiedAt={refund.verifiedAt} lang={i18n.language} reviewedBy={refund.reviewedBy} />}
          </section>
        )}

        <p className="rounded-2xl bg-accent-soft px-4 py-3 text-[13px] leading-snug text-ink-2">{t('fica.disclaimer')}</p>
      </div>
    </Sheet>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-ink">{n}</span>
      <div className="min-w-0 text-[14px] leading-snug text-ink-2">
        <p className="mb-1 text-[15px] font-semibold text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
      {children} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function SourceLine({ url, label, verifiedAt, lang, reviewedBy }: { url: string; label: string; verifiedAt: string; lang: string; reviewedBy: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 flex flex-col gap-1">
      <Ext href={url}>
        {t('common.source')}: {label}
      </Ext>
      <span className="flex flex-wrap items-center gap-x-3 text-[12px] text-ink-3">
        {t('common.verifiedOn', { date: formatDateISO(verifiedAt, lang) })}
        {reviewedBy && (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('settings.reviewedBy', { who: reviewedBy })}
          </span>
        )}
      </span>
    </div>
  );
}
