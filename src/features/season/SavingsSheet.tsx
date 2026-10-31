import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { CURRENCY_COUNTRY, CURRENCY_SYMBOL, dayKey, manualRateOk, needsConversion, toLocalCents, type HomeCurrency } from '@/domain';
import type { SavingsKind, SavingsRow } from '@/data/db';
import { fetchLocalFx, localFxRule, type FxQuote, type LocalFxRule } from '@/data/fx';
import { useProfile } from '@/data/hooks';
import { createSavings, deleteSavings, updateSavings } from '@/data/repos/savings';
import { formatDateISO, formatLocal, formatRate } from '@/shared/lib/format';
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
  const lang = i18n.language;
  const toast = useToast();
  const online = useOnline();
  const profile = useProfile();
  // Un movimiento existente se queda en la moneda en que se guardó.
  const currency: HomeCurrency = entry?.fxCurrency ?? profile?.homeCurrency ?? 'PEN';
  const convert = needsConversion(currency);
  const [kind, setKind] = useState<SavingsKind>(defaultKind);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dayKey(Date.now()));
  const [note, setNote] = useState('');
  const [manual, setManual] = useState(false);
  const [manualRate, setManualRate] = useState('');
  const [rate, setRate] = useState<RateState>({ status: 'idle' });
  const [fxRule, setFxRule] = useState<LocalFxRule | null>(null);
  const [errors, setErrors] = useState<{ amount?: string; rate?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Chile y Bolivia: sin consulta automática, siempre a mano.
  const manualOnly = fxRule?.mode === 'manual';

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

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void localFxRule(currency).then((r) => {
      if (!alive) return;
      setFxRule(r);
      if (r?.mode === 'manual') setManual(true);
    });
    return () => {
      alive = false;
    };
  }, [open, currency]);

  // Tipo de cambio oficial para la fecha elegida.
  useEffect(() => {
    if (!open || manual || !convert) return;
    if (entry && entry.date === date && entry.fxSource && entry.fxSource !== 'manual' && entry.fxRate && entry.fxDate) {
      setRate({ status: 'ok', quote: { date: entry.fxDate, value: entry.fxRate, series: '', source: '', provider: entry.fxSource } });
      return;
    }
    if (!online) return setRate({ status: 'offline' });
    let alive = true;
    setRate({ status: 'loading' });
    void fetchLocalFx(date, currency).then((q) => {
      if (alive) setRate(q ? { status: 'ok', quote: q } : { status: 'missing' });
    });
    return () => {
      alive = false;
    };
  }, [open, date, manual, online, entry, currency, convert]);

  const cents = parseMoneyInput(amount);
  const manualValue = Number(manualRate.replace(',', '.'));
  const effectiveRate = !convert ? null : manual ? (manualValue > 0 ? manualValue : null) : rate.status === 'ok' ? rate.quote!.value : null;
  const name = t(`money.name.${currency}`);

  const save = async () => {
    const e: typeof errors = {};
    if (cents === null || cents <= 0) e.amount = t('savings.errors.amount');
    if (convert && manual && !manualRateOk(currency, manualValue)) e.rate = t('savings.errors.rate');
    setErrors(e);
    if (Object.keys(e).length) return tap('warning');
    const fx = !convert
      ? { fxRate: null, fxDate: null, fxSource: null }
      : manual
        ? { fxRate: manualValue, fxDate: date, fxSource: 'manual' as const }
        : rate.status === 'ok'
          ? { fxRate: rate.quote!.value, fxDate: rate.quote!.date, fxSource: rate.quote!.provider }
          : { fxRate: null, fxDate: null, fxSource: null };
    const draft = { kind, amountCents: cents!, date, note, fxCurrency: currency, ...fx };
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

  const sourceName = fxRule?.label ? fxRule.label[lang.startsWith('en') ? 'en' : 'es'] : '';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? t('savings.editTitle') : t('savings.newTitle')}
      footer={
        <div className="flex flex-col gap-2.5">
          {effectiveRate && cents ? (
            <div className="flex items-center justify-between px-1 pb-1 text-[14px]">
              <span className="text-ink-2">{t('savings.inPen', { name, amount: '' })}</span>
              <span className="tnum text-[17px] font-semibold text-ink">{formatLocal(toLocalCents(cents, effectiveRate), currency, lang)}</span>
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

        {entry && profile && entry.fxCurrency !== profile.homeCurrency && (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] leading-snug text-ink-2">{t('savings.otherCurrencyNote', { name })}</p>
        )}

        {!convert ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">{t('savings.usdNote')}</p>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4">
            <span className="text-sm font-medium text-ink-2">{t('savings.rate')}</span>
            {manualOnly && (
              <p className="text-[13px] leading-snug text-ink-2">
                {t('savings.manualOnly', { country: t(`money.country.${CURRENCY_COUNTRY[currency]}`) })}{' '}
                {fxRule?.pageUrl && (
                  <a href={fxRule.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">
                    {t('savings.manualOnlyLink', { source: sourceName })} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </p>
            )}
            {manual ? (
              <Input
                label={t('savings.rateManualLabel', { name: name.charAt(0).toUpperCase() + name.slice(1) })}
                prefix={CURRENCY_SYMBOL[currency]}
                inputMode="decimal"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                error={errors.rate}
                numeric
              />
            ) : (
              <p className="flex items-center gap-2 text-[15px] text-ink">
                {rate.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
                {rate.status === 'loading' && t('savings.rateLoading')}
                {rate.status === 'ok' &&
                  t('savings.rateOfficial', {
                    source: t(`money.source.${rate.quote!.provider}`),
                    date: formatDateISO(rate.quote!.date, lang),
                    symbol: CURRENCY_SYMBOL[currency],
                    value: formatRate(rate.quote!.value, currency, lang),
                  })}
                {rate.status === 'offline' && t('savings.rateOffline')}
                {rate.status === 'missing' && t('savings.rateMissing')}
              </p>
            )}
            {!manualOnly && (
              <button type="button" onClick={() => setManual((v) => !v)} className="self-start py-1 text-[14px] font-semibold text-accent">
                {manual ? t('savings.rateUseBcrp') : t('savings.rateManual')}
              </button>
            )}
          </div>
        )}

        <Input label={t('savings.note')} placeholder={t('savings.notePlaceholder')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>
  );
}
