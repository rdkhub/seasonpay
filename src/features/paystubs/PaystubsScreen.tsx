import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight, Plus, Receipt, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { addDays, comparePaystub, ficaAlertForPaystub, periodRange, type PaystubComparison } from '@/domain';
import type { PaystubRow } from '@/data/db';
import { useAllShiftsBetween, useEmployers, usePaystubs, useProfile, useRules } from '@/data/hooks';
import { statePremium, toEmployerConfig, toShiftInput } from '@/data/mappers';
import { cn } from '@/shared/lib/cn';
import { formatDateISO, formatMoney } from '@/shared/lib/format';
import { useNow } from '@/shared/lib/useNow';
import { Badge, Button, Card, EmptyState, MoneyDisplay, PressableCard, SectionTitle, TaxDisclaimer } from '@/shared/ui';
import { track } from '@/data/telemetry';
import { OfflinePill } from '@/shared/ui/OfflinePill';
import { FicaSheet } from './FicaSheet';
import { PaystubDetailSheet } from './PaystubDetailSheet';
import { PaystubFormSheet } from './PaystubFormSheet';
import { useFica } from './useFica';

export function PaystubsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const now = useNow(60_000);
  const profile = useProfile();
  const rules = useRules();
  const employers = useEmployers(true);
  const paystubs = usePaystubs();

  // Rango de turnos que necesitamos: desde el periodo más viejo hasta el más nuevo, ±7 días para el overtime.
  const span = useMemo(() => {
    const ranges = (paystubs ?? []).map((p) => periodRange(p.periodStart, p.periodEnd)).filter((r): r is { from: number; to: number } => !!r);
    if (ranges.length === 0) return { from: 0, to: 0 };
    return { from: addDays(Math.min(...ranges.map((r) => r.from)), -7), to: addDays(Math.max(...ranges.map((r) => r.to)), 7) };
  }, [paystubs]);
  const shifts = useAllShiftsBetween(span.from, span.to);

  const comparisons = useMemo(() => {
    const map = new Map<string, PaystubComparison | null>();
    const inputs = (shifts ?? []).map(toShiftInput);
    const premium = statePremium(rules, profile?.workState);
    for (const p of paystubs ?? []) {
      const emp = employers?.find((e) => e.id === p.employerId);
      map.set(p.id, emp ? comparePaystub(p, inputs, toEmployerConfig(emp, premium), now) : null);
    }
    return map;
  }, [paystubs, shifts, employers, now, rules, profile?.workState]);

  const fica = useFica(profile, rules, paystubs, now);
  const year = new Date(now).getFullYear();
  const thisYear = (paystubs ?? []).filter((p) => p.payDate.startsWith(String(year)));
  const totals = thisYear.reduce(
    (a, p) => ({
      net: a.net + p.netCents,
      gross: a.gross + p.grossCents,
      withheld: a.withheld + p.federalTaxCents + p.stateTaxCents + p.socialSecurityCents + p.medicareCents,
    }),
    { net: 0, gross: 0, withheld: 0 },
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaystubRow | null>(null);
  const [detail, setDetail] = useState<PaystubRow | null>(null);
  const [ficaOpen, setFicaOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const FicaIcon = fica.status === 'possibly_exempt' ? (fica.withheldCents > 0 ? ShieldAlert : ShieldCheck) : fica.status === 'unknown' ? ShieldQuestion : ShieldCheck;
  const ficaAlert = fica.showRefundFlow;
  useEffect(() => {
    if (ficaAlert) void track('fica_alert_shown');
  }, [ficaAlert]);

  return (
    <div className="pb-24">
      <header className="mb-4 px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-ink">{t('paystubs.title')}</h1>
      </header>
      <TaxDisclaimer className="mb-4" />

      <OfflinePill />

      {/* Dato principal: lo cobrado en el año */}
      <Card tone="hero" className="p-6">
        <div className="text-[14px] font-medium text-white/75">{t('paystubs.netYear', { year })}</div>
        <MoneyDisplay cents={totals.net} size="display" className="mt-3 block text-white" />
        <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-medium">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/90">{t('paystubs.grossYear', { amount: formatMoney(totals.gross, lang, { noCents: true }) })}</span>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/90">{t('paystubs.withheldYear', { amount: formatMoney(totals.withheld, lang, { noCents: true }) })}</span>
        </div>
      </Card>

      {/* FICA */}
      <PressableCard onClick={() => setFicaOpen(true)} className={cn('mt-3 flex gap-3.5 p-4', ficaAlert && 'ring-2 ring-warn')}>
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', ficaAlert ? 'bg-warn/15 text-warn' : 'bg-accent-soft text-accent')}>
          <FicaIcon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t('fica.cardTitle')}</span>
          <span className="mt-0.5 block text-[16px] font-semibold text-ink">{t(`fica.${fica.status}`)}</span>
          <span className="mt-1 block text-[13px] leading-snug text-ink-2">
            {fica.withheldCents > 0 ? t('fica.withheld', { amount: formatMoney(fica.withheldCents, lang) }) : t('fica.noneWithheld')}
          </span>
          <span className="mt-2 block text-[13px] font-semibold text-accent">{ficaAlert ? t('fica.seeRefund') : t('fica.seeDetails')} →</span>
        </span>
      </PressableCard>

      <SectionTitle>{t('paystubs.list')}</SectionTitle>
      {paystubs && paystubs.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title={t('paystubs.emptyTitle')}
          body={t('paystubs.emptyBody')}
          action={
            <Button block onClick={openNew} disabled={!employers?.length}>
              {t('paystubs.add')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(paystubs ?? []).map((p) => {
            const c = comparisons.get(p.id);
            const noShifts = c?.flags.includes('no_shifts');
            const review = c && c.flags.length > 0 && !noShifts;
            return (
              <PressableCard
                key={p.id}
                onClick={() => {
                  setDetail(p);
                  // Métricas: boleta revisada y, si la comparación encontró diferencias, discrepancia.
                  void track('paystub_reviewed');
                  if ((c?.flags.length ?? 0) > 0) void track('discrepancy_detected', { flags: c!.flags.length });
                }}
                className="flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="tnum text-[15px] font-semibold text-ink">
                    {formatDateISO(p.periodStart, lang)} – {formatDateISO(p.periodEnd, lang)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 truncate text-[13px] text-ink-3">
                    {employers?.find((e) => e.id === p.employerId)?.name}
                    {ficaAlertForPaystub(fica, p) && <AlertTriangle className="h-3.5 w-3.5 text-warn" aria-label="FICA" />}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <MoneyDisplay cents={p.netCents} size="sm" className="text-ink" />
                  <div className="mt-1">
                    {noShifts ? <Badge>{t('paystubs.statusNoShifts')}</Badge> : review ? <Badge tone="warn">{t('paystubs.statusReview')}</Badge> : <Badge tone="positive">{t('paystubs.statusOk')}</Badge>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-3" />
              </PressableCard>
            );
          })}
        </div>
      )}

      {/* Acción principal, abajo */}
      {paystubs && paystubs.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
          <Button className="pointer-events-auto w-full max-w-lg shadow-lift" size="lg" icon={<Plus className="h-5 w-5" />} onClick={openNew}>
            {t('paystubs.add')}
          </Button>
        </div>
      )}

      <PaystubFormSheet open={formOpen} onClose={() => setFormOpen(false)} employers={employers ?? []} paystub={editing} />
      <PaystubDetailSheet
        paystub={detail}
        comparison={detail ? comparisons.get(detail.id) ?? null : null}
        employer={employers?.find((e) => e.id === detail?.employerId)}
        onClose={() => setDetail(null)}
        onEdit={() => {
          setEditing(detail);
          setDetail(null);
          setFormOpen(true);
        }}
        onFica={() => {
          setDetail(null);
          setFicaOpen(true);
        }}
        showFicaLink={fica.status === 'possibly_exempt'}
      />
      <FicaSheet open={ficaOpen} onClose={() => setFicaOpen(false)} assessment={fica} rules={rules ?? []} />
    </div>
  );
}
