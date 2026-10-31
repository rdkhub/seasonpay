import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HandCoins, MessageSquareHeart, Play, Plus, Smartphone, Square, Sun, X } from 'lucide-react';
import { openFeedback } from '@/features/feedback/feedbackStore';
import { InstallSheet } from '@/features/install/InstallSheet';
import { dismissInstallOffer, shouldOfferInstall } from '@/features/install/installGuide';
import { startOfDay, addDays } from '@/domain';
import { db, type ShiftRow } from '@/data/db';
import { useActiveShift } from '@/data/hooks';
import { startShift, stopShift } from '@/data/repos/shifts';
import { summarizeDay, useWeekSummary } from '@/features/week/useWeekSummary';
import { formatHours, formatHoursShort, formatLongDate, formatMoney, formatTime, formatTimer } from '@/shared/lib/format';
import { tap } from '@/shared/lib/haptics';
import { useNow } from '@/shared/lib/useNow';
import { Badge, Button, Card, EmptyState, MoneyDisplay, OptionList, PressableCard, Sheet, useToast } from '@/shared/ui';
import { OfflinePill } from '@/shared/ui/OfflinePill';
import { FinishShiftSheet } from './FinishShiftSheet';
import { ShiftFormSheet } from './ShiftFormSheet';
import { TipsSheet } from './TipsSheet';

export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const toast = useToast();
  const active = useActiveShift();
  const now = useNow(active ? 1000 : 30_000);
  const week = useWeekSummary(now, now);
  const today = useMemo(() => summarizeDay(week, now, now), [week, now]);

  const [pickOpen, setPickOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [finishing, setFinishing] = useState<ShiftRow | null>(null);
  const [offerInstall, setOfferInstall] = useState(() => shouldOfferInstall());
  const [installOpen, setInstallOpen] = useState(false);

  const activeEmployers = week.employers.filter((e) => !e.archived);
  const dayFrom = startOfDay(now);
  const dayTo = addDays(dayFrom, 1);
  const todayShifts = week.contextShifts.filter((s) => s.startedAt >= dayFrom && s.startedAt < dayTo);
  // Un turno nocturno que empezó ayer y sigue en curso también se muestra hoy.
  if (active && !todayShifts.some((s) => s.id === active.id)) todayShifts.push(active);

  const activeBreakdown = active ? week.summary.byShift.get(active.id) : undefined;
  const activePay = activeBreakdown ? activeBreakdown.basePayCents + activeBreakdown.overtimePayCents + activeBreakdown.doubleTimePayCents : 0;
  const activeEmployer = active ? week.employerById.get(active.employerId) : undefined;

  const begin = async (employerId: string) => {
    setPickOpen(false);
    await startShift(employerId);
    tap('success');
    toast(t('today.startedToast'));
  };

  const onStartPress = () => {
    if (activeEmployers.length === 1) void begin(activeEmployers[0]!.id);
    else setPickOpen(true);
  };

  const onStopPress = async () => {
    if (!active) return;
    await stopShift(active.id);
    tap('success');
    const stopped = await db.shifts.get(active.id);
    setFinishing(stopped ?? null);
  };

  const openManual = () => {
    setTipsOpen(false);
    setEditing(null);
    setFormOpen(true);
  };

  const elapsedSec = active ? (now - active.startedAt) / 1000 : 0;
  const s = week.summary;

  return (
    <div className="flex min-h-[calc(100dvh-104px-max(16px,env(safe-area-inset-top))-env(safe-area-inset-bottom))] flex-col">
      <header className="mb-4 flex items-center justify-between px-1 pt-2">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t('common.today')}</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{formatLongDate(now, lang)}</h1>
        </div>
        <button
          type="button"
          data-no-capture
          aria-label={t('feedback.title')}
          onClick={() => void openFeedback()}
          className="-mr-1 grid h-11 w-11 place-items-center rounded-full bg-surface text-accent shadow-card ring-1 ring-line/70 active:scale-95"
        >
          <MessageSquareHeart className="h-5 w-5" />
        </button>
      </header>

      <OfflinePill />

      {offerInstall && (
        <div data-no-capture className="mb-3 flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3">
          <Smartphone className="h-5 w-5 shrink-0 text-accent" />
          <button type="button" onClick={() => setInstallOpen(true)} className="min-w-0 flex-1 text-left">
            <span className="block text-[14px] font-semibold text-ink">{t('install.cardTitle')}</span>
            <span className="block text-[13px] leading-snug text-ink-2">{t('install.cardBody')}</span>
          </button>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => {
              dismissInstallOffer();
              setOfferInstall(false);
            }}
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />

      {/* Dato principal: lo ganado en la semana */}
      <Card tone="hero" className="animate-rise-in p-6">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-white/75">{t('today.weekEarned')}</span>
          <Badge tone="inverse">{t('common.estimated')}</Badge>
        </div>
        <MoneyDisplay cents={s.grossCents} size="display" className="mt-3 block text-white" />
        <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-medium">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/90">{t('today.weekMeta', { hours: formatHours(s.workedMinutes) })}</span>
          {s.overtimeMinutes + s.doubleTimeMinutes > 0 && (
            <span className="rounded-full bg-white/20 px-3 py-1.5 text-white">{t('today.overtimeChip', { hours: formatHours(s.overtimeMinutes + s.doubleTimeMinutes) })}</span>
          )}
          {s.tipsCents > 0 && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/90">{t('today.tipsChip', { amount: formatMoney(s.tipsCents, lang, { noCents: true }) })}</span>
          )}
        </div>
      </Card>

      {/* Hoy */}
      <section className="mt-4 animate-rise-in [animation-delay:60ms]">
        <div className="grid grid-cols-3 gap-2.5">
          <MiniStat label={t('today.hoursToday')} value={formatHoursShort(today.workedMinutes)} />
          <MiniStat label={t('today.tipsToday')} value={<MoneyDisplay cents={today.tipsCents} size="sm" />} />
          <MiniStat label={t('today.earnedToday')} value={<MoneyDisplay cents={today.grossCents} size="sm" />} />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {todayShifts.filter((x) => x.id !== active?.id).map((sh) => {
            const b = week.summary.byShift.get(sh.id);
            return (
              <PressableCard
                key={sh.id}
                onClick={() => {
                  setEditing(sh);
                  setFormOpen(true);
                }}
                className="flex items-center justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <div className="tnum text-[15px] font-semibold text-ink">
                    {formatTime(sh.startedAt, lang)} – {sh.endedAt ? formatTime(sh.endedAt, lang) : '…'}
                  </div>
                  <div className="truncate text-[13px] text-ink-3">{week.employerById.get(sh.employerId)?.name}</div>
                </div>
                <div className="tnum text-right text-[15px] font-semibold text-ink">{b ? formatHours(b.workedMinutes) : ''}</div>
              </PressableCard>
            );
          })}
          {todayShifts.length === 0 && !week.loading && (
            <EmptyState icon={<Sun />} title={t('today.noShiftsTodayTitle')} body={t('today.noShiftsTodayBody')} className="py-6" />
          )}
        </div>
      </section>

      <div className="min-h-6 flex-1" />

      {/* Zona del pulgar: acciones grandes abajo */}
      <section className="sticky bottom-[calc(104px+env(safe-area-inset-bottom))] -mx-4 mt-2 flex flex-col gap-2.5 bg-gradient-to-t from-bg from-70% to-transparent px-4 pt-4">
        {active && (
          <Card className="animate-rise-in p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-accent">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                </span>
                {t('today.running')}
              </span>
              <span className="truncate pl-3 text-[13px] text-ink-3">{activeEmployer?.name}</span>
            </div>
            <div className="tnum mt-2 text-[44px] font-semibold leading-none tracking-[-0.03em] text-ink" aria-live="off">
              {formatTimer(elapsedSec)}
            </div>
            <div className="mt-2 flex items-center justify-between text-[14px] text-ink-2">
              <span>{t('today.since', { time: formatTime(active.startedAt, lang) })}</span>
              <span className="tnum font-medium">{t('today.soFar', { amount: formatMoney(activePay, lang) })}</span>
            </div>
          </Card>
        )}

        {active ? (
          <Button size="xl" variant="ink" block icon={<Square className="h-5 w-5 fill-current" />} onClick={onStopPress}>
            {t('today.stop')}
          </Button>
        ) : (
          <Button
            size="xl"
            block
            icon={<Play className="h-6 w-6 fill-current" />}
            onClick={onStartPress}
            disabled={activeEmployers.length === 0}
           
          >
            {t('today.start')}
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" size="lg" icon={<Plus className="h-5 w-5" />} onClick={openManual}>
            {t('today.manual')}
          </Button>
          <Button variant="secondary" size="lg" icon={<HandCoins className="h-5 w-5" />} onClick={() => setTipsOpen(true)}>
            {t('today.tips')}
          </Button>
        </div>
      </section>

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title={t('today.pickEmployerTitle')}>
        <div className="pb-2">
          <OptionList
            ariaLabel={t('today.pickEmployerTitle')}
            options={activeEmployers.map((e) => ({ value: e.id, label: e.name, description: `${formatMoney(e.hourlyRateCents, lang)}${t('common.perHour')}` }))}
            value={null}
            onChange={(id) => void begin(id)}
          />
        </div>
      </Sheet>

      <TipsSheet open={tipsOpen} onClose={() => setTipsOpen(false)} todayShifts={todayShifts} employerById={week.employerById} onAddShift={openManual} />

      <ShiftFormSheet open={formOpen} onClose={() => setFormOpen(false)} employers={week.employers} shift={editing} defaultDate={now} />

      <FinishShiftSheet shift={finishing} onClose={() => setFinishing(null)} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-3.5 py-3 shadow-card ring-1 ring-line/70">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="tnum mt-1.5 whitespace-nowrap text-[17px] font-semibold leading-none text-ink">{value}</div>
    </div>
  );
}
