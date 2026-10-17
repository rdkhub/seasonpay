import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Trash2 } from 'lucide-react';
import { dayKey, resolveShiftTimes, timeKey, validateShift, workedMinutes, type ShiftValidationError } from '@/domain';
import type { EmployerRow, ShiftRow } from '@/data/db';
import { createShift, deleteShift, updateShift } from '@/data/repos/shifts';
import { formatHours } from '@/shared/lib/format';
import { centsToInput, parseMoneyInput } from '@/shared/lib/money';
import { tap } from '@/shared/lib/haptics';
import { Badge, Button, Input, SegmentedControl, Select, Sheet, Stepper, useToast } from '@/shared/ui';

interface ShiftFormSheetProps {
  open: boolean;
  onClose: () => void;
  employers: EmployerRow[];
  /** Si viene, se edita; si no, se crea uno nuevo. */
  shift?: ShiftRow | null;
  defaultDate?: number;
}

interface FormState {
  employerId: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  cash: string;
  card: string;
  note: string;
}

function initialState(employers: EmployerRow[], shift: ShiftRow | null | undefined, defaultDate: number): FormState {
  if (shift) {
    return {
      employerId: shift.employerId,
      date: dayKey(shift.startedAt),
      start: timeKey(shift.startedAt),
      end: shift.endedAt ? timeKey(shift.endedAt) : '',
      breakMinutes: shift.breakMinutes,
      cash: centsToInput(shift.cashTipsCents),
      card: centsToInput(shift.cardTipsCents),
      note: shift.note,
    };
  }
  return {
    employerId: employers.find((e) => !e.archived)?.id ?? employers[0]?.id ?? '',
    date: dayKey(defaultDate),
    start: '09:00',
    end: '17:00',
    breakMinutes: 30,
    cash: '',
    card: '',
    note: '',
  };
}

export function ShiftFormSheet({ open, onClose, employers, shift, defaultDate }: ShiftFormSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const isEdit = !!shift;
  const isActive = !!shift && shift.endedAt === null;
  const [f, setF] = useState<FormState>(() => initialState(employers, shift, defaultDate ?? Date.now()));
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setF(initialState(employers, shift, defaultDate ?? Date.now()));
      setSubmitted(false);
      setConfirmDelete(false);
    }
    // Solo al abrir: no queremos pisar lo que el usuario está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shift?.id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const selectable = employers.filter((e) => !e.archived || e.id === f.employerId);

  const parsed = useMemo(() => {
    const cash = parseMoneyInput(f.cash);
    const card = parseMoneyInput(f.card);
    const errors: (ShiftValidationError | 'times' | 'money')[] = [];
    if (cash === null || card === null) errors.push('money');

    let start: number | null = null;
    let end: number | null = null;
    let crosses = false;
    if (isActive) {
      const r = resolveShiftTimes(f.date, f.start, f.start);
      start = r ? r.start : null;
      if (start === null) errors.push('times');
    } else {
      const r = resolveShiftTimes(f.date, f.start, f.end);
      if (!r) errors.push('times');
      else {
        start = r.start;
        end = r.end;
        crosses = r.crossesMidnight;
      }
    }
    if (start !== null) {
      errors.push(
        ...validateShift({ start, end, breakMinutes: f.breakMinutes, cashTipsCents: cash ?? 0, cardTipsCents: card ?? 0 }),
      );
    }
    const minutes = start !== null ? workedMinutes({ start, end, breakMinutes: f.breakMinutes }, Date.now()) : 0;
    return { start, end, crosses, cash: cash ?? 0, card: card ?? 0, errors, minutes };
  }, [f, isActive]);

  const firstError = parsed.errors[0];
  const showErrors = submitted && !!firstError;

  const save = async () => {
    setSubmitted(true);
    if (parsed.errors.length > 0 || parsed.start === null || !f.employerId) {
      tap('warning');
      return;
    }
    setSaving(true);
    try {
      const data = {
        employerId: f.employerId,
        startedAt: parsed.start,
        endedAt: isActive ? null : parsed.end,
        breakMinutes: f.breakMinutes,
        cashTipsCents: parsed.cash,
        cardTipsCents: parsed.card,
        note: f.note.trim(),
      };
      if (shift) await updateShift(shift.id, data);
      else await createShift(data);
      tap('success');
      toast(t('shiftForm.saved'));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!shift) return;
    if (!confirmDelete) {
      tap('warning');
      setConfirmDelete(true);
      return;
    }
    await deleteShift(shift.id);
    toast(t('shiftForm.deleted'));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? t('shiftForm.editTitle') : t('shiftForm.newTitle')}
      footer={
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[14px] text-ink-2">{t('shiftForm.worked')}</span>
            <span className="tnum text-[17px] font-semibold text-ink">{formatHours(parsed.minutes)}</span>
          </div>
          <Button size="lg" block onClick={save} loading={saving}>
            {t('common.save')}
          </Button>
          {isEdit && (
            <Button size="md" block variant={confirmDelete ? 'danger' : 'danger-soft'} icon={<Trash2 className="h-5 w-5" />} onClick={remove}>
              {confirmDelete ? t('shiftForm.confirmDelete') : t('shiftForm.deleteShift')}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {selectable.length > 1 &&
          (selectable.length <= 3 ? (
            <div className="flex flex-col gap-1.5">
              <span className="px-1 text-sm font-medium text-ink-2">{t('shiftForm.employer')}</span>
              <SegmentedControl
                ariaLabel={t('shiftForm.employer')}
                options={selectable.map((e) => ({ value: e.id, label: e.name }))}
                value={f.employerId}
                onChange={(v) => set('employerId', v)}
              />
            </div>
          ) : (
            <Select label={t('shiftForm.employer')} value={f.employerId} onChange={(e) => set('employerId', e.target.value)}>
              {selectable.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          ))}

        <Input type="date" label={t('shiftForm.date')} value={f.date} onChange={(e) => set('date', e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input type="time" label={t('shiftForm.start')} value={f.start} onChange={(e) => set('start', e.target.value)} numeric />
          {isActive ? (
            <div className="flex flex-col gap-1.5">
              <span className="px-1 text-sm font-medium text-ink-2">{t('shiftForm.end')}</span>
              <div className="flex h-14 items-center rounded-2xl bg-accent-soft px-4 text-[15px] font-semibold text-accent">
                {t('shiftForm.inProgress')}
              </div>
            </div>
          ) : (
            <Input
              type="time"
              label={t('shiftForm.end')}
              value={f.end}
              onChange={(e) => set('end', e.target.value)}
              numeric
            />
          )}
        </div>
        {parsed.crosses && (
          <p className="-mt-2 flex items-center gap-2 px-1 text-[13px] font-medium text-accent">
            <Moon className="h-4 w-4" />
            {t('shiftForm.crossesMidnight')}
            <Badge tone="accent">{t('shiftForm.nextDay')}</Badge>
          </p>
        )}

        <Stepper
          label={t('shiftForm.break')}
          value={f.breakMinutes}
          onChange={(v) => set('breakMinutes', v)}
          min={0}
          max={240}
          step={5}
          format={(v) => t('shiftForm.breakFormat', { min: v })}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('tips.cash')} prefix="$" inputMode="decimal" placeholder="0.00" value={f.cash} onChange={(e) => set('cash', e.target.value)} numeric />
          <Input label={t('tips.card')} prefix="$" inputMode="decimal" placeholder="0.00" value={f.card} onChange={(e) => set('card', e.target.value)} numeric />
        </div>

        <Input label={t('shiftForm.note')} placeholder={t('shiftForm.notePlaceholder')} value={f.note} maxLength={500} onChange={(e) => set('note', e.target.value)} />

        {showErrors && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger">
            {t(`shiftForm.errors.${firstError}`)}
          </p>
        )}
      </div>
    </Sheet>
  );
}
