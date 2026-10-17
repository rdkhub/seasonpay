import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateQuote, type ReceiveCurrency } from '@/domain';
import type { RemitProviderRow } from '@/data/db';
import { addQuote } from '@/data/repos/remit';
import { parseMoneyInput } from '@/shared/lib/money';
import { tap } from '@/shared/lib/haptics';
import { Button, Input, SegmentedControl, Select, Sheet } from '@/shared/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  providers: RemitProviderRow[];
}

const OTHER = 'other';

/** Copiar una cotización de la app de un proveedor: cuánto pagas en total y cuánto llega. */
export function QuoteSheet({ open, onClose, providers }: Props) {
  const { t } = useTranslation();
  const [providerId, setProviderId] = useState('');
  const [currency, setCurrency] = useState<ReceiveCurrency>('PEN');
  const [paid, setPaid] = useState('');
  const [received, setReceived] = useState('');
  const [errors, setErrors] = useState<{ paid?: string; received?: string }>({});

  useEffect(() => {
    if (!open) return;
    setProviderId(providers[0]?.id ?? OTHER);
    setCurrency('PEN');
    setPaid('');
    setReceived('');
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const provider = providers.find((p) => p.id === providerId);
  const currencies: ReceiveCurrency[] = provider ? provider.receiveCurrencies : ['PEN', 'USD'];

  // Si el proveedor elegido no entrega en la moneda marcada, pasamos a la que sí entrega.
  useEffect(() => {
    if (!currencies.includes(currency)) setCurrency(currencies[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  const save = async () => {
    const totalPaidCents = parseMoneyInput(paid) ?? 0;
    const receivedCents = parseMoneyInput(received) ?? 0;
    const v = validateQuote({ totalPaidCents, receivedCents });
    if (v.totalPaid || v.received) {
      tap('warning');
      return setErrors({ paid: v.totalPaid && t('remit.required'), received: v.received && t('remit.required') });
    }
    await addQuote({ providerId, totalPaidCents, receivedCents, receiveCurrency: currency });
    tap('success');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('remit.quoteTitle')}
      description={t('remit.quoteBody')}
      footer={
        <Button size="lg" block onClick={save}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label={t('remit.provider')} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={OTHER}>{t('remit.otherProvider')}</option>
        </Select>
        <Input
          label={t('remit.paidLabel')}
          hint={t('remit.paidHint')}
          prefix="$"
          inputMode="decimal"
          placeholder="500.00"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          error={errors.paid}
          numeric
        />
        {currencies.length > 1 && (
          <SegmentedControl
            ariaLabel={t('remit.receiveIn')}
            value={currency}
            onChange={(v) => setCurrency(v as ReceiveCurrency)}
            options={currencies.map((c) => ({ value: c, label: t(`remit.currency.${c}`) }))}
          />
        )}
        <Input
          label={t('remit.receivedLabel')}
          prefix={currency === 'PEN' ? 'S/' : '$'}
          inputMode="decimal"
          placeholder={currency === 'PEN' ? '1,700.00' : '490.00'}
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          error={errors.received}
          numeric
        />
      </div>
    </Sheet>
  );
}
