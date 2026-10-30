import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2 } from 'lucide-react';
import { dayKey, toPenCents } from '@/domain';
import type { SavingsKind, SavingsRow } from '@/data/db';
import { fetchFx, type FxQuote } from '@/data/fx';
import { createSavings, deleteSavings, updateSavings } from '@/data/repos/savings';
import { formatDateISO, formatPen } from '@/shared/lib/format';
import { centsToInput, parseMoneyInput } from '@/shared/lib/money';
import { tap } from '@/shared/lib/haptics';
import { useOnline } from '@/shared/lib/useOnline';
import { Button, Input, SegmentedControl, Sheet, useToast } from '@/shared/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  entry?: SavingsRow | null;
  defaultKind?: SavingsKind;
}

type RateState = { status: 'idle' | 'loading' | 'ok' | 'offline' | 'missing'; quote?: FxQuote };

export function SavingsSheet({ open, onClose, entry, defaultKind = 'save' }: Props) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const [kind, setKind] = useState<SavingsKind>(defaultKind);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dayKey(Date.now()));
  const [note, setNote] = useState('');
  const [manual, setManual] = useState(false);
  const [manualRate, setManualRate] = useState('');
  const [rate, setRate] = useState<RateState>({ status: 'idle' });
  const [errors, setErrors] = useState<{ amount?: string; rate?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setConfirmDelete(false);
    setKind(entry?.kind ?? defaultKind);
    setAmount(entry ? centsToInput(entry.amountCents, false) : '');
    setDate(entry?.date ?? dayKey(Date.now()));
    setNote(entry?.note ?? '');
    setManual(entry?.fxSource === 'manual');
    setManualRate(entry?.fxSource === 'manual' && entry.fxRate ? String(entry.fxRate) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  // Tipo de cambio del BCRP para la fecha elegida.
  useEffect(() => {
    if (!open || manual) return;
    if (entry && entry.date === date && (entry.fxSource === 'bcrp' || entry.fxSource === 'sunat') && entry.fxRate && entry.fxDate) {
      setRate({ status: 'ok', quote: { date: entry.fxDate, value: entry.fxRate, series: '', source: '', provider: entry.fxSource } });
      return;
    }
    if (!online) return setRate({ status: 'offline' });
    let alive = true;
    setRate({ status: 'loading' });
    void fetchFx(date).then((q) => {
      if (alive) setRate(q ? { status: 'ok', quote: q } : { status: 'missing' });
    });
    return () => {
      alive = false;
    };
  }, [open, date, manual, online, entry]);

  const cents = parseMoneyInput(amount);
  const manualValue = Number(manualRate.replace(',', '.'));
  const effectiveRate = manual ? (manualValue > 0 ? manualValue : null) : rate.status === 'ok' ? rate.quote!.value : null;

  const save = async () => {
    const e: typeof errors = {};
    if (cents === null || cents <= 0) e.amount = t('savings.errors.amount');
    if (manual && !(manualValue > 0 && manualValue < 100)) e.rate = t('savings.errors.rate');
    setErrors(e);
    if (Object.keys(e).length) return tap('warning');
    const fx = manual
      ? { fxRate: manualValue, fxDate: date, fxSource: 'manual' as const }
      : rate.status === 'ok'
        ? { fxRate: rate.quote!.value, fxDate: rate.quote!.date, fxSource: rate.quote!.provider }
        : { fxRate: null, fxDate: null, fxSource: null };
    const draft = { kind, amountCents: cents!, date, note, ...fx };
    if (entry) await updateSavings(entry.id, draft);
    else await createSavings(draft);
    tap('success');
    toast(t('savings.saved'));
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    if (!confirmDelete) {
      tap('warning');
      return setConfirmDelete(true);
    }
    await deleteSavings(entry.id);
    toast(t('savings.deleted'));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? t('savings.editTitle') : t('savings.newTitle')}
      footer={
        <div className="flex flex-col gap-2.5">
          {effectiveRate && cents ? (
            <div className="flex items-center justify-between px-1 pb-1 text-[14px]">
              <span className="text-ink-2">{t('savings.inPen', { amount: '' })}</span>
              <span className="tnum text-[17px] font-semibold text-ink">{formatPen(toPenCents(cents, effectiveRate), i18n.language)}</span>
            </div>
          ) : null}
          <Button size="lg" block onClick={save}>
            {t('common.save')}
          </Button>
          {entry && (
            <Button variant={confirmDelete ? 'danger' : 'danger-soft'} block icon={<Trash2 className="h-5 w-5" />} onClick={remove}>
              {confirmDelete ? t('savings.confirmDelete') : t('savings.delete')}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <SegmentedControl
          ariaLabel={t('savings.newTitle')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'save', label: t('savings.kindSave') },
            { value: 'withdraw', label: t('savings.kindWithdraw') },
          ]}
        />
        <Input label={t('savings.amount')} prefix="$" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} numeric autoFocus={!entry} />
        <Input type="date" label={t('savings.date')} value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4">
          <span className="text-sm font-medium text-ink-2">{t('savings.rate')}</span>
          {manual ? (
            <Input label={t('savings.rateManualLabel')} prefix="S/" inputMode="decimal" placeholder="3.450" value={manualRate} onChange={(e) => setManualRate(e.target.value)} error={errors.rate} numeric />
          ) : (
            <p className="flex items-center gap-2 text-[15px] text-ink">
              {rate.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
              {rate.status === 'loading' && t('savings.rateLoading')}
              {rate.status === 'ok' && t(rate.quote!.provider === 'sunat' ? 'savings.rateSunat' : 'savings.rateBcrp', { date: formatDateISO(rate.quote!.date, i18n.language), value: rate.quote!.value.toFixed(3) })}
              {rate.status === 'offline' && t('savings.rateOffline')}
              {rate.status === 'missing' && t('savings.rateMissing')}
            </p>
          )}
          <button type="button" onClick={() => setManual((v) => !v)} className="self-start py-1 text-[14px] font-semibold text-accent">
            {manual ? t('savings.rateUseBcrp') : t('savings.rateManual')}
          </button>
        </div>

        <Input label={t('savings.note')} placeholder={t('savings.notePlaceholder')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>
  );
}
