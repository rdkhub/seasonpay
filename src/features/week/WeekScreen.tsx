import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, ChevronLeft, ChevronRight, Info, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { addDays, dayKey, startOfDay } from '@/domain';
import type { ShiftRow } from '@/data/db';
import { ShiftFormSheet } from '@/features/shifts/ShiftFormSheet';
import { cn } from '@/shared/lib/cn';
import { formatDayMonth, formatHours, formatMoney, formatTime, formatWeekday, formatWeekRange } from '@/shared/lib/format';
import { tap } from '@/shared/lib/haptics';
import { useNow } from '@/shared/lib/useNow';
import { Badge, Button, Card, EmptyState, ListGroup, ListRow, MoneyDisplay, PressableCard, SectionTitle, Stat } from '@/shared/ui';
import { OfflinePill } from '@/shared/ui/OfflinePill';
import { useWeekSummary } from './useWeekSummary';

export function WeekScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const now = useNow(30_000);
  const [anchor, setAnchor] = useState(() => Date.now());
  const week = useWeekSummary(anchor, now);
  const { summary: s, range } = week;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftRow | null>(null);

  const isCurrent = range.from <= now && now < range.to;
  const isLast = !isCurrent && range.to <= now && now < addDays(range.to, 7);
  const label = isCurrent ? t('week.thisWeek') : isLast ? t('week.lastWeek') : formatWeekRange(range.from, range.to, lang);

  const byDay = useMemo(() => {
    const groups = new Map<string, { day: number; shifts: ShiftRow[] }>();
    for (const sh of week.shifts) {
      const k = dayKey(sh.startedAt);
      const g = groups.get(k) ?? { day: startOfDay(sh.startedAt), shifts: [] };
      g.shifts.push(sh);
      groups.set(k, g);
    }
    return [...groups.values()].sort((a, b) => b.day - a.day);
  }, [week.shifts]);

  const go = (dir: -1 | 1) => {
    tap();
    setAnchor((a) => addDays(a, dir * 7));
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const employersWithShifts = s.byEmployer.filter((e) => e.regularMinutes + e.overtimeMinutes > 0 || e.grossCents > 0);

  return (
    <div className="pb-20">
      <header className="mb-4 px-1 pt-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t('week.title')}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{formatWeekRange(range.from, range.to, lang)}</h1>
      </header>

      <OfflinePill />

      {/* Dato principal: pago bruto estimado */}
      <Card tone="hero" className="p-6" key={range.from}>
        <div className="flex animate-fade-in items-center justify-between">
          <span className="text-[14px] font-medium text-white/75">{t('week.gross')}</span>
          <Badge tone="inverse">{t('common.estimated')}</Badge>
        </div>
        <MoneyDisplay cents={s.grossCents} size="display" className="mt-3 block animate-fade-in text-white" />
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
          <HeroCell label={t('week.base')} cents={s.basePayCents} />
          <HeroCell label={t('week.overtimePay')} cents={s.overtimePayCents} />
          <HeroCell label={t('week.tips')} cents={s.tipsCents} />
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Stat label={t('week.regular')} value={formatHours(s.regularMinutes)} />
        <Stat label={t('week.overtime')} value={formatHours(s.overtimeMinutes)} accent={s.overtimeMinutes > 0} />
        <Stat
          label={t('week.tips')}
          value={<MoneyDisplay cents={s.tipsCents} size="md" />}
          sub={t('week.tipsSplit', { cash: formatMoney(s.cashTipsCents, lang, { noCents: true }), card: formatMoney(s.cardTipsCents, lang, { noCents: true }) })}
        />
        <Stat label={t('week.shifts')} value={s.shiftCount} />
      </div>

      {employersWithShifts.length > 1 && (
        <>
          <SectionTitle>{t('week.byEmployer')}</SectionTitle>
          <ListGroup>
            {employersWithShifts.map((e) => (
              <ListRow
                key={e.employerId}
                title={week.employerById.get(e.employerId)?.name ?? '—'}
                subtitle={`${formatHours(e.regularMinutes + e.overtimeMinutes)}${e.overtimeMinutes ? ` · ${formatHours(e.overtimeMinutes)} extra` : ''}`}
                trailing={<MoneyDisplay cents={e.grossCents} size="sm" className="text-ink" />}
              />
            ))}
          </ListGroup>
        </>
      )}

      <SectionTitle
        action={
          byDay.length > 0 ? (
            <button type="button" onClick={openNew} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-accent active:bg-accent-soft">
              <CalendarPlus className="h-4 w-4" /> {t('common.add')}
            </button>
          ) : undefined
        }
      >
        {t('week.list')}
      </SectionTitle>

      {byDay.length === 0 && !week.loading ? (
        <EmptyState
          icon={<CalendarPlus />}
          title={t('week.emptyTitle')}
          body={t('week.emptyBody')}
          action={
            <Button block onClick={openNew}>
              {t('week.addShift')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {byDay.map((g) => (
            <div key={g.day}>
              <div className="mb-2 px-1 text-[14px] font-semibold text-ink-2">
                {formatWeekday(g.day, lang, 'long')} <span className="font-normal text-ink-3">{formatDayMonth(g.day, lang)}</span>
              </div>
              <div className="flex flex-col gap-2">
                {g.shifts.map((sh) => {
                  const b = s.byShift.get(sh.id);
                  const pay = b ? b.basePayCents + b.overtimePayCents : 0;
                  const crosses = sh.endedAt !== null && dayKey(sh.endedAt) !== dayKey(sh.startedAt);
                  return (
                    <PressableCard
                      key={sh.id}
                      onClick={() => {
                        setEditing(sh);
                        setFormOpen(true);
                      }}
                      className="flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="tnum flex items-center gap-1.5 text-[16px] font-semibold text-ink">
                          {formatTime(sh.startedAt, lang)} – {sh.endedAt ? formatTime(sh.endedAt, lang) : t('shiftForm.inProgress')}
                          {crosses && <Moon className="h-3.5 w-3.5 text-accent" aria-label={t('shiftForm.crossesMidnight')} />}
                        </div>
                        <div className="mt-0.5 truncate text-[13px] text-ink-3">
                          {week.employerById.get(sh.employerId)?.name}
                          {sh.breakMinutes > 0 && ` · ${t('shiftForm.breakFormat', { min: sh.breakMinutes })}`}
                          {b && b.tipsCents > 0 && ` · ${formatMoney(b.tipsCents, lang)} ${t('week.tips').toLowerCase()}`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <MoneyDisplay cents={pay} size="sm" className="text-ink" />
                        <div className="tnum mt-1 flex items-center justify-end gap-1.5 text-[13px] text-ink-3">
                          {b && b.overtimeMinutes > 0 && <Badge tone="accent">+{formatHours(b.overtimeMinutes)}</Badge>}
                          {b ? formatHours(b.workedMinutes) : ''}
                        </div>
                      </div>
                    </PressableCard>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 flex gap-2.5 px-1 text-[13px] leading-snug text-ink-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t('week.disclaimer')}{' '}
          <Link to="/settings" className="font-medium text-accent underline-offset-2 hover:underline">
            {t('settings.sources')}
          </Link>
        </span>
      </p>

      {/* Navegación entre semanas, al alcance del pulgar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface/95 p-1.5 shadow-lift ring-1 ring-line/70 backdrop-blur-xl">
          <NavBtn label={t('week.prev')} onClick={() => go(-1)}>
            <ChevronLeft className="h-6 w-6" />
          </NavBtn>
          <button
            type="button"
            onClick={() => {
              tap();
              setAnchor(Date.now());
            }}
            aria-label={t('week.goToday')}
            className={cn('h-12 min-w-[140px] rounded-full px-4 text-[15px] font-semibold transition active:scale-95', isCurrent ? 'text-ink' : 'bg-accent-soft text-accent')}
          >
            {label}
          </button>
          <NavBtn label={t('week.next')} onClick={() => go(1)}>
            <ChevronRight className="h-6 w-6" />
          </NavBtn>
        </div>
      </div>

      <ShiftFormSheet open={formOpen} onClose={() => setFormOpen(false)} employers={week.employers} shift={editing} defaultDate={isCurrent ? now : range.from} />
    </div>
  );
}

function HeroCell({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[12px] font-medium text-white/65">{label}</div>
      <MoneyDisplay cents={cents} size="sm" className="mt-1 block text-white" />
    </div>
  );
}

function NavBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid h-12 w-12 place-items-center rounded-full text-ink-2 transition active:scale-90 active:bg-surface-2">
      {children}
    </button>
  );
}
