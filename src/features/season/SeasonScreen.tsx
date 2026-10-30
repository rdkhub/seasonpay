import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, ClipboardList, Download, ExternalLink, PiggyBank, Send, Target } from 'lucide-react';
import { summarizeSavings, toPenCents } from '@/domain';
import type { SavingsKind, SavingsRow } from '@/data/db';
import { fillPendingRates } from '@/data/fx';
import { useProfile, useRules, useSavings } from '@/data/hooks';
import { saveProfile } from '@/data/repos/profile';
import { cn } from '@/shared/lib/cn';
import { formatDateISO, formatMoney, formatPen } from '@/shared/lib/format';
import { centsToInput, parseMoneyInput } from '@/shared/lib/money';
import { tap } from '@/shared/lib/haptics';
import { useOnline } from '@/shared/lib/useOnline';
import { Badge, Button, Card, EmptyState, Input, ListGroup, MoneyDisplay, PressableCard, SectionTitle, Sheet, TaxDisclaimer, useToast } from '@/shared/ui';
import { OfflinePill } from '@/shared/ui/OfflinePill';
import { CHECKLIST } from './checklist';
import { ExportSheet } from './ExportSheet';
import { SavingsSheet } from './SavingsSheet';
import { DeadlinesCard } from './DeadlinesCard';
import { SurveySheet } from './SurveySheet';
import { useMetaValue } from '@/data/hooks';

export function SeasonScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const profile = useProfile();
  const rules = useRules();
  const savings = useSavings();

  const summary = useMemo(() => summarizeSavings(savings ?? [], profile?.savingsGoalCents ?? null), [savings, profile?.savingsGoalCents]);

  // Al volver la señal, completamos los tipos de cambio pendientes.
  useEffect(() => {
    if (online && savings?.some((s) => s.fxRate === null)) void fillPendingRates(savings);
  }, [online, savings]);

  const [sheet, setSheet] = useState<{ open: boolean; entry: SavingsRow | null; kind: SavingsKind }>({ open: false, entry: null, kind: 'save' });
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const surveyDone = useMetaValue<number>('surveyDone');

  const done = new Set(profile?.checklistDone ?? []);
  const toggle = (id: string) => {
    tap();
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void saveProfile({ checklistDone: [...next] });
  };

  const ruleOf = (key?: string, stateRule?: boolean) =>
    key
      ? (rules ?? [])
          .filter((r) => r.key === key && (!stateRule || r.jurisdiction === profile?.workState))
          .sort((a, b) => b.year - a.year)[0]
      : undefined;
  const addr8843 = (ruleOf('form_8843_filing')?.value as { without_return_mail_to?: string } | undefined)?.without_return_mail_to ?? '—';

  const saveGoal = async () => {
    const c = parseMoneyInput(goal);
    await saveProfile({ savingsGoalCents: c && c > 0 ? c : null });
    toast(t('season.goalSaved'));
    setGoalOpen(false);
  };

  return (
    <div className="pb-24">
      <header className="mb-4 px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-ink">{t('season.title')}</h1>
      </header>

      <OfflinePill />

      {/* Dato principal: lo ahorrado */}
      <Card tone="hero" className="p-6">
        <div className="text-[14px] font-medium text-white/75">{t('season.saved')}</div>
        <MoneyDisplay cents={summary.balanceCents} size="display" className="mt-3 block text-white" />
        <div className="tnum mt-2 text-[15px] font-medium text-white/85">{t('season.inPen', { amount: formatPen(summary.balancePenCents, lang) })}</div>
        {summary.pendingRateCount > 0 && <div className="mt-1 text-[12px] text-white/70">{t('season.pendingRates', { count: summary.pendingRateCount })}</div>}
        {summary.goalProgress !== null && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white transition-[width] duration-500 ease-out" style={{ width: `${Math.round(summary.goalProgress * 100)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-white/80">
              <span>{t('season.goalProgress', { pct: Math.round(summary.goalProgress * 100) })}</span>
              <span className="tnum">{t('season.goal', { amount: formatMoney(profile?.savingsGoalCents ?? 0, lang, { noCents: true }) })}</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setGoal(centsToInput(profile?.savingsGoalCents ?? 0));
            setGoalOpen(true);
          }}
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-4 text-[13px] font-semibold text-white active:scale-95"
        >
          <Target className="h-4 w-4" /> {profile?.savingsGoalCents ? t('season.editGoal') : t('season.setGoal')}
        </button>
      </Card>

      <SectionTitle>{t('season.movements')}</SectionTitle>
      {savings && savings.length === 0 ? (
        <EmptyState icon={<PiggyBank />} title={t('season.emptyTitle')} body={t('season.emptyBody')} />
      ) : (
        <ListGroup>
          {(savings ?? []).slice(0, 20).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSheet({ open: true, entry: s, kind: s.kind })}
              className="flex min-h-[64px] w-full items-center gap-3.5 px-4 py-3 text-left active:bg-surface-2"
            >
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', s.kind === 'save' ? 'bg-positive/10 text-positive' : 'bg-surface-2 text-ink-2')}>
                {s.kind === 'save' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{s.note || (s.kind === 'save' ? t('savings.kindSave') : t('savings.kindWithdraw'))}</span>
                <span className="mt-0.5 flex items-center gap-2 overflow-hidden whitespace-nowrap text-[13px] text-ink-3">
                  {formatDateISO(s.date, lang)}
                  {s.fxRate ? <span className="tnum">· S/ {s.fxRate.toFixed(3)}</span> : <Badge tone="warn">{t('savings.pendingBadge')}</Badge>}
                  {s.fxSource === 'manual' && <Badge>{t('savings.manualBadge')}</Badge>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cn('tnum block text-[15px] font-semibold', s.kind === 'save' ? 'text-ink' : 'text-ink-2')}>
                  {s.kind === 'save' ? '+' : '−'}
                  {formatMoney(s.amountCents, lang)}
                </span>
                {s.fxRate && <span className="tnum block text-[12px] text-ink-3">{formatPen(toPenCents(s.amountCents, s.fxRate), lang)}</span>}
              </span>
            </button>
          ))}
        </ListGroup>
      )}

      <SectionTitle>{t('remit.title')}</SectionTitle>
      <PressableCard onClick={() => navigate('/season/send')} className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Send className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{t('remit.entryTitle')}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{t('remit.entryBody')}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-3" />
      </PressableCard>

      <SectionTitle>{t('deadlines.section')}</SectionTitle>
      <DeadlinesCard rules={rules ?? []} workState={profile?.workState ?? null} />
      <TaxDisclaimer className="mt-3" />

      <SectionTitle action={<span className="tnum text-[13px] font-medium text-ink-3">{t('season.checklistProgress', { done: CHECKLIST.filter((c) => done.has(c.id)).length, total: CHECKLIST.length })}</span>}>
        {t('season.checklist')}
      </SectionTitle>
      <ListGroup>
        {CHECKLIST.map((item) => {
          const isDone = done.has(item.id);
          const rule = ruleOf(item.ruleKey, item.stateRule);
          const bodyKey = item.stateRule && !rule ? `checklist.${item.id}.bodyNoRule` : `checklist.${item.id}.body`;
          return (
            <div key={item.id} className="flex gap-3.5 px-4 py-3.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={t(`checklist.${item.id}.title`)}
                onClick={() => toggle(item.id)}
                className={cn(
                  'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-2 transition-all duration-150 active:scale-90',
                  isDone ? 'bg-accent text-accent-ink ring-accent' : 'ring-line',
                )}
              >
                {isDone && <Check className="h-[18px] w-[18px]" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[15px] font-semibold', isDone ? 'text-ink-3 line-through' : 'text-ink')}>{t(`checklist.${item.id}.title`)}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t(bodyKey, { address: addr8843, state: profile?.workState ?? '' })}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {item.to && (
                    <button
                      type="button"
                      onClick={() => (item.to === 'export' ? setExportOpen(true) : item.to === 'savings' ? setSheet({ open: true, entry: null, kind: 'save' }) : navigate(item.to!))}
                      className="inline-flex items-center gap-1 py-1 text-[13px] font-semibold text-accent"
                    >
                      {t('checklist.open')} <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {rule && (
                    <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 py-1 text-[13px] font-semibold text-accent">
                      {t('checklist.source')} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {rule && <p className="text-[11px] text-ink-3">{t('common.verifiedOn', { date: formatDateISO(rule.verifiedAt, lang) })}</p>}
              </div>
            </div>
          );
        })}
      </ListGroup>

      <SectionTitle>{t('season.export')}</SectionTitle>
      <PressableCard onClick={() => setExportOpen(true)} className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Download className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{t('season.export')}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{t('season.exportBody')}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-3" />
      </PressableCard>

      <SectionTitle>{t('survey.section')}</SectionTitle>
      <PressableCard onClick={() => setSurveyOpen(true)} className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <ClipboardList className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{surveyDone ? t('survey.doneTitle') : t('survey.cardTitle')}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{surveyDone ? t('survey.doneBody') : t('survey.cardBody')}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-3" />
      </PressableCard>

      {/* Acciones principales, abajo */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
        <div className="pointer-events-auto grid w-full max-w-lg grid-cols-2 gap-2.5">
          <Button size="lg" className="shadow-lift" icon={<ArrowDownLeft className="h-5 w-5" />} onClick={() => setSheet({ open: true, entry: null, kind: 'save' })}>
            {t('season.addSave')}
          </Button>
          <Button size="lg" variant="secondary" className="shadow-lift" icon={<ArrowUpRight className="h-5 w-5" />} onClick={() => setSheet({ open: true, entry: null, kind: 'withdraw' })}>
            {t('season.addWithdraw')}
          </Button>
        </div>
      </div>

      <SavingsSheet open={sheet.open} entry={sheet.entry} defaultKind={sheet.kind} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
      <SurveySheet open={surveyOpen} onClose={() => setSurveyOpen(false)} />
      <Sheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title={t('season.goalTitle')}
        footer={
          <Button size="lg" block onClick={saveGoal}>
            {t('common.save')}
          </Button>
        }
      >
        <Input label={t('season.goalLabel')} prefix="$" inputMode="decimal" placeholder="3000" value={goal} onChange={(e) => setGoal(e.target.value)} numeric autoFocus />
      </Sheet>
    </div>
  );
}
