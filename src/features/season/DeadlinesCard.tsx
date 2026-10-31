import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { BellOff, BellRing, CalendarClock, ExternalLink } from 'lucide-react';
import { daysUntil, dayKey, seasonDeadlines, seasonTaxYears, type DeadlineRuleInput } from '@/domain';
import { db, type TaxRuleRow } from '@/data/db';
import { currentSubscription, disableReminders, enableReminders, pushSupport, type PushSupport } from '@/data/push';
import { formatDateISO } from '@/shared/lib/format';
import { tap } from '@/shared/lib/haptics';
import { Button, Card, useToast } from '@/shared/ui';

/**
 * Fechas límite de la temporada (1040-NR y declaración estatal), calculadas con tax_rules.
 * Una temporada de invierno cruza dos años tributarios: se muestran los dos.
 */
export function DeadlinesCard({ rules, workState }: { rules: TaxRuleRow[]; workState: string | null }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const lang = i18n.language;
  const starts = useLiveQuery(async () => (await db.shifts.filter((s) => s.deletedAt === null).toArray()).map((s) => s.startedAt), []);

  const pick = (key: string, jurisdiction: string, taxYear?: number) =>
    rules
      .filter((r) => r.key === key && r.jurisdiction === jurisdiction && (taxYear === undefined || r.year <= taxYear))
      .sort((a, b) => b.year - a.year)[0];

  const today = dayKey(Date.now());
  const years = useMemo(() => seasonTaxYears(starts ?? [], Date.now()), [starts]);
  const fedRule = pick('form_1040nr_due_date', 'federal');
  const stateRule = workState ? pick('state_return_due_date', workState) : undefined;
  const deadlines = seasonDeadlines(years, {
    federal: fedRule?.value as DeadlineRuleInput['federal'],
    state: stateRule?.value as DeadlineRuleInput['state'],
  });

  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushSupport().then(setSupport);
    void currentSubscription().then((s) => setSubscribed(!!s));
  }, []);

  const toggleReminders = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        await disableReminders();
        setSubscribed(false);
        toast(t('reminders.off'));
        return;
      }
      const r = await enableReminders(lang);
      if (r === 'enabled') {
        tap('success');
        setSubscribed(true);
        toast(t('reminders.on'));
      } else {
        tap('warning');
        toast(t(`reminders.result.${r}`), 'info');
      }
    } finally {
      setBusy(false);
    }
  };

  if (deadlines.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <CalendarClock className="h-5 w-5 text-accent" />
        <h3 className="text-[16px] font-semibold text-ink">{t('deadlines.title')}</h3>
      </div>
      {years.length > 1 && <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{t('deadlines.twoYears', { years: years.join(' y ') })}</p>}
      <ul className="mt-3 divide-y divide-line">
        {deadlines.map((d) => {
          const days = daysUntil(d.date, today);
          return (
            <li key={`${d.kind}-${d.taxYear}`} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-ink">
                  {d.kind === 'federal' ? t('deadlines.federal') : t('deadlines.state', { state: workState })}
                </span>
                <span className="block text-[13px] text-ink-3">{t('deadlines.taxYear', { year: d.taxYear })}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="tnum block text-[15px] font-semibold text-ink">{formatDateISO(d.date, lang)}</span>
                <span className="tnum block text-[12px] text-ink-3">
                  {days >= 0 ? t('deadlines.inDays', { count: days }) : t('deadlines.passed')}
                </span>
                {d.weekend && <span className="block text-[12px] font-semibold text-warn">{t(`deadlines.weekend.${d.weekend}`)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] leading-snug text-ink-3">{t('deadlines.note')}</p>
      {deadlines.some((d) => d.weekend) && <p className="mt-1.5 text-[12px] leading-snug text-ink-2">{t('deadlines.weekendNote')}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4">
        {[fedRule, stateRule].filter(Boolean).map((r) => (
          <a key={r!.id} href={r!.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 py-1.5 text-[13px] font-semibold text-accent">
            {r!.jurisdiction === 'federal' ? 'IRS' : t('deadlines.stateSource', { state: r!.jurisdiction })} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      </div>
      {fedRule && <p className="text-[11px] text-ink-3">{t('common.verifiedOn', { date: formatDateISO(fedRule.verifiedAt, lang) })}</p>}

      {support && support !== 'unsupported' && (
        <div className="mt-4">
          {support === 'ios_needs_install' || support === 'ios_too_old' ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] leading-snug text-ink-2">{t(`reminders.result.${support}`)}</p>
          ) : (
            <Button
              block
              variant={subscribed ? 'secondary' : 'primary'}
              loading={busy}
              disabled={support === 'not_configured'}
              icon={subscribed ? <BellOff className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
              onClick={toggleReminders}
            >
              {subscribed ? t('reminders.disable') : t('reminders.enable')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
