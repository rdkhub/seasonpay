import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HandCoins } from 'lucide-react';
import type { EmployerRow, ShiftRow } from '@/data/db';
import { updateShift } from '@/data/repos/shifts';
import { formatTime } from '@/shared/lib/format';
import { centsToInput, parseMoneyInput } from '@/shared/lib/money';
import { tap } from '@/shared/lib/haptics';
import { Button, EmptyState, Input, MoneyDisplay, OptionList, Sheet, useToast } from '@/shared/ui';

interface TipsSheetProps {
  open: boolean;
  onClose: () => void;
  todayShifts: ShiftRow[];
  employerById: Map<string, EmployerRow>;
  onAddShift: () => void;
}

/** Propinas del día: se guardan dentro de uno de los turnos de hoy. */
export function TipsSheet({ open, onClose, todayShifts, employerById, onAddShift }: TipsSheetProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');

  const target = todayShifts.find((s) => s.id === shiftId) ?? null;

  useEffect(() => {
    if (!open) return;
    const last = todayShifts[todayShifts.length - 1] ?? null;
    setShiftId(last?.id ?? null);
    setCash(centsToInput(last?.cashTipsCents ?? 0));
    setCard(centsToInput(last?.cardTipsCents ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (id: string) => {
    const s = todayShifts.find((x) => x.id === id);
    setShiftId(id);
    setCash(centsToInput(s?.cashTipsCents ?? 0));
    setCard(centsToInput(s?.cardTipsCents ?? 0));
  };

  const cashC = parseMoneyInput(cash);
  const cardC = parseMoneyInput(card);
  const valid = cashC !== null && cardC !== null;
  const total = (cashC ?? 0) + (cardC ?? 0);

  const options = useMemo(
    () =>
      todayShifts.map((s) => ({
        value: s.id,
        label: employerById.get(s.employerId)?.name ?? '—',
        description: `${formatTime(s.startedAt, i18n.language)}${s.endedAt ? ` – ${formatTime(s.endedAt, i18n.language)}` : ` · ${t('shiftForm.inProgress')}`}`,
      })),
    [todayShifts, employerById, i18n.language, t],
  );

  const save = async () => {
    if (!target || !valid) return tap('warning');
    await updateShift(target.id, { cashTipsCents: cashC!, cardTipsCents: cardC! });
    tap('success');
    toast(t('tips.saved'));
    onClose();
  };

  if (todayShifts.length === 0) {
    return (
      <Sheet open={open} onClose={onClose} title={t('tips.title')}>
        <EmptyState
          icon={<HandCoins />}
          title={t('tips.noShiftTitle')}
          body={t('tips.noShiftBody')}
          action={
            <Button block onClick={onAddShift}>
              {t('today.manual')}
            </Button>
          }
          className="mb-2"
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('tips.title')}
      description={t('tips.body')}
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-[14px] text-ink-2">{t('tips.total')}</span>
            <MoneyDisplay cents={total} size="md" />
          </div>
          <Button size="lg" block onClick={save} disabled={!valid}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {todayShifts.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-medium text-ink-2">{t('tips.shift')}</span>
            <OptionList ariaLabel={t('tips.shift')} options={options} value={shiftId} onChange={pick} />
          </div>
        )}
        <Input
          label={t('tips.cash')}
          prefix="$"
          inputMode="decimal"
          placeholder="0.00"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          error={cashC === null ? t('shiftForm.errors.money') : undefined}
          numeric
          autoFocus
        />
        <Input
          label={t('tips.card')}
          hint={t('tips.cardHint')}
          prefix="$"
          inputMode="decimal"
          placeholder="0.00"
          value={card}
          onChange={(e) => setCard(e.target.value)}
          error={cardC === null ? t('shiftForm.errors.money') : undefined}
          numeric
        />
      </div>
    </Sheet>
  );
}
