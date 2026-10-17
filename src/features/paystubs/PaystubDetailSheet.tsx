import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, Pencil } from 'lucide-react';
import type { PaystubComparison, PaystubFlag } from '@/domain';
import type { EmployerRow, PaystubRow } from '@/data/db';
import { cn } from '@/shared/lib/cn';
import { formatDateISO, formatHours, formatMoney } from '@/shared/lib/format';
import { Button, Sheet } from '@/shared/ui';

interface Props {
  paystub: PaystubRow | null;
  comparison: PaystubComparison | null;
  employer: EmployerRow | undefined;
  onClose: () => void;
  onEdit: () => void;
  onFica: () => void;
  showFicaLink: boolean;
}

export function PaystubDetailSheet({ paystub, comparison: c, employer, onClose, onEdit, onFica, showFicaLink }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  if (!paystub) return <Sheet open={false} onClose={onClose}><div /></Sheet>;

  const m = (cents: number) => formatMoney(cents, lang);
  const flagText = (f: PaystubFlag) => {
    if (!c) return '';
    const hours = formatHours(Math.abs(f.startsWith('overtime') ? c.diffOvertimeMinutes : c.diffRegularMinutes + c.diffOvertimeMinutes));
    const amount = m(Math.abs(f === 'card_tips_missing' ? c.diffCardTipsCents : c.diffWagesCents));
    return t(`paystubs.flags.${f}`, { diff: hours, amount });
  };

  const withheld = paystub.federalTaxCents + paystub.stateTaxCents + paystub.socialSecurityCents + paystub.medicareCents;
  const ok = c && c.flags.length === 0;

  return (
    <Sheet
      open={!!paystub}
      onClose={onClose}
      title={t('paystubs.detailTitle', { from: formatDateISO(paystub.periodStart, lang), to: formatDateISO(paystub.periodEnd, lang) })}
      description={employer?.name}
      footer={
        <Button variant="secondary" size="lg" block icon={<Pencil className="h-5 w-5" />} onClick={onEdit}>
          {t('common.edit')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {c && (
          <div className={cn('rounded-2xl p-4', ok ? 'bg-positive/10' : 'bg-warn/10')}>
            {ok ? (
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <CheckCircle2 className="h-5 w-5 text-positive" /> {t('paystubs.statusOk')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {c.flags.map((f) => (
                  <li key={f} className="flex gap-2 text-[14px] leading-snug text-ink">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                    {flagText(f)}
                  </li>
                ))}
              </ul>
            )}
            {!ok && <p className="mt-3 text-[13px] text-ink-2">{t('paystubs.askEmployer')}</p>}
          </div>
        )}

        {c && (
          <section>
            <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t('paystubs.compareTitle')}</h3>
            <div className="overflow-hidden rounded-2xl bg-surface-2">
              <Row head label="" a={t('paystubs.colStub')} b={t('paystubs.colShifts')} />
              <Row label={t('paystubs.rowRegular')} a={formatHours(paystub.regularMinutes)} b={formatHours(c.expectedRegularMinutes)} warn={Math.abs(c.diffRegularMinutes) > 15} />
              <Row label={t('paystubs.rowOvertime')} a={formatHours(paystub.overtimeMinutes)} b={formatHours(c.expectedOvertimeMinutes)} warn={Math.abs(c.diffOvertimeMinutes) > 15} />
              <Row label={t('paystubs.rowWages')} a={m(c.stubWagesCents)} b={m(c.expectedWagesCents)} warn={Math.abs(c.diffWagesCents) > 100} />
              <Row label={t('paystubs.rowCardTips')} a={m(paystub.tipsCents)} b={m(c.expectedCardTipsCents)} warn={c.diffCardTipsCents < -100} />
            </div>
            <p className="mt-2 flex gap-2 px-1 text-[12px] leading-snug text-ink-3">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('paystubs.compareNote')}
            </p>
          </section>
        )}

        <section>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t('paystubs.deductionsTitle')}</h3>
          <div className="overflow-hidden rounded-2xl bg-surface-2">
            <Line label={t('paystubs.gross')} value={m(paystub.grossCents)} strong />
            <Line label={t('paystubs.federalTax')} value={`− ${m(paystub.federalTaxCents)}`} />
            <Line label={t('paystubs.stateTax')} value={`− ${m(paystub.stateTaxCents)}`} />
            <Line label={t('paystubs.socialSecurity')} value={`− ${m(paystub.socialSecurityCents)}`} highlight={paystub.socialSecurityCents > 0 && showFicaLink} />
            <Line label={t('paystubs.medicare')} value={`− ${m(paystub.medicareCents)}`} highlight={paystub.medicareCents > 0 && showFicaLink} />
            <Line label={t('paystubs.otherDeductions')} value={`− ${m(paystub.otherDeductionsCents)}`} />
            <Line label={t('paystubs.totalWithheld')} value={m(withheld)} />
            <Line label={t('paystubs.net')} value={m(paystub.netCents)} strong />
          </div>
          {showFicaLink && (
            <button type="button" onClick={onFica} className="mt-3 flex h-11 items-center gap-1.5 px-1 text-[14px] font-semibold text-accent">
              {t('fica.seeRefund')} →
            </button>
          )}
        </section>
      </div>
    </Sheet>
  );
}

function Row({ label, a, b, warn, head }: { label: string; a: string; b: string; warn?: boolean; head?: boolean }) {
  return (
    <div className={cn('grid grid-cols-[1.3fr_1fr_1fr] items-center gap-2 border-b border-line/60 px-4 py-3 last:border-0', head && 'py-2')}>
      <span className={cn('text-[14px]', head ? 'text-[12px] font-semibold text-ink-3' : 'text-ink-2')}>{label}</span>
      <span className={cn('tnum text-right text-[14px] font-semibold', head ? 'text-[12px] text-ink-3' : warn ? 'text-warn' : 'text-ink')}>{a}</span>
      <span className={cn('tnum text-right text-[14px]', head ? 'text-[12px] font-semibold text-ink-3' : 'text-ink-2')}>{b}</span>
    </div>
  );
}

function Line({ label, value, strong, highlight }: { label: string; value: string; strong?: boolean; highlight?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between border-b border-line/60 px-4 py-3 last:border-0', highlight && 'bg-warn/10')}>
      <span className={cn('text-[14px]', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{label}</span>
      <span className={cn('tnum text-[14px]', strong ? 'font-semibold text-ink' : 'text-ink')}>{value}</span>
    </div>
  );
}
