import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShiftRow } from '@/data/db';
import { updateShift } from '@/data/repos/shifts';
import { spanMinutes } from '@/domain';
import { centsToInput, parseMoneyInput } from '@/shared/lib/money';
import { tap } from '@/shared/lib/haptics';
import { Button, Input, Sheet, Stepper, useToast } from '@/shared/ui';

interface FinishShiftSheetProps {
  shift: ShiftRow | null;
  onClose: () => void;
}

/** Después de terminar el turno: descanso y propinas en un solo paso. */
export function FinishShiftSheet({ shift, onClose }: FinishShiftSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [breakMin, setBreakMin] = useState(0);
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');

  useEffect(() => {
    if (!shift) return;
    setBreakMin(shift.breakMinutes);
    setCash(centsToInput(shift.cashTipsCents));
    setCard(centsToInput(shift.cardTipsCents));
  }, [shift]);

  const maxBreak = shift?.endedAt ? Math.max(0, spanMinutes(shift.startedAt, shift.endedAt) - 1) : 0;
  const cashC = parseMoneyInput(cash);
  const cardC = parseMoneyInput(card);
  const valid = cashC !== null && cardC !== null;

  const save = async () => {
    if (!shift || !valid) return tap('warning');
    await updateShift(shift.id, { breakMinutes: Math.min(breakMin, maxBreak), cashTipsCents: cashC!, cardTipsCents: cardC! });
    tap('success');
    toast(t('today.stoppedToast'));
    onClose();
  };

  return (
    <Sheet
      open={!!shift}
      onClose={onClose}
      title={t('today.finishTitle')}
      description={t('today.finishBody')}
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t('common.skip')}
          </Button>
          <Button size="lg" onClick={save} disabled={!valid}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Stepper
          label={t('shiftForm.break')}
          value={breakMin}
          onChange={setBreakMin}
          min={0}
          max={Math.min(240, maxBreak)}
          step={5}
          format={(v) => t('shiftForm.breakFormat', { min: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('tips.cash')} prefix="$" inputMode="decimal" placeholder="0.00" value={cash} onChange={(e) => setCash(e.target.value)} numeric />
          <Input label={t('tips.card')} prefix="$" inputMode="decimal" placeholder="0.00" value={card} onChange={(e) => setCard(e.target.value)} numeric />
        </div>
      </div>
    </Sheet>
  );
}
