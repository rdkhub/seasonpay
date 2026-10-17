import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Trash2 } from 'lucide-react';
import type { EmployerRow, PaystubRow } from '@/data/db';
import { createPaystub, deletePaystub, updatePaystub } from '@/data/repos/paystubs';
import { tap } from '@/shared/lib/haptics';
import { Button, Input, SegmentedControl, Select, Sheet, useToast } from '@/shared/ui';
import { emptyPaystubForm, paystubToForm, validatePaystubForm, type PaystubFormErrors, type PaystubFormValue } from './paystubForm';

interface Props {
  open: boolean;
  onClose: () => void;
  employers: EmployerRow[];
  paystub?: PaystubRow | null;
}

export function PaystubFormSheet({ open, onClose, employers, paystub }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const active = employers.filter((e) => !e.archived || e.id === paystub?.employerId);
  const [v, setV] = useState<PaystubFormValue>(() => emptyPaystubForm(active[0], Date.now()));
  const [errors, setErrors] = useState<PaystubFormErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setConfirmDelete(false);
    setV(paystub ? paystubToForm(paystub) : emptyPaystubForm(active[0], Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paystub?.id]);

  const set = <K extends keyof PaystubFormValue>(k: K, val: PaystubFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: keyof PaystubFormErrors) => (errors[k] ? t(errors[k]!) : undefined);

  const onEmployer = (id: string) => {
    // Al cambiar de empleador en una boleta nueva, sugerimos su periodo de pago.
    if (paystub) return set('employerId', id);
    const e = employers.find((x) => x.id === id);
    const base = emptyPaystubForm(e, Date.now());
    setV((p) => ({ ...p, employerId: id, periodStart: base.periodStart, periodEnd: base.periodEnd }));
  };

  const save = async () => {
    const { errors: e, draft } = validatePaystubForm(v);
    setErrors(e);
    if (!draft) return tap('warning');
    setSaving(true);
    try {
      if (paystub) await updatePaystub(paystub.id, draft);
      else await createPaystub(draft);
      tap('success');
      toast(t('paystubs.saved'));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!paystub) return;
    if (!confirmDelete) {
      tap('warning');
      return setConfirmDelete(true);
    }
    await deletePaystub(paystub.id);
    toast(t('paystubs.deleted'));
    onClose();
  };

  const money = (k: keyof PaystubFormValue, label: string, hint?: string) => (
    <Input label={label} hint={hint} prefix="$" inputMode="decimal" placeholder="0.00" value={v[k]} onChange={(e) => set(k, e.target.value)} error={err(k)} numeric />
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={paystub ? t('paystubs.editTitle') : t('paystubs.newTitle')}
      footer={
        <div className="flex flex-col gap-2.5">
          <Button size="lg" block onClick={save} loading={saving}>
            {t('common.save')}
          </Button>
          {paystub && (
            <Button variant={confirmDelete ? 'danger' : 'danger-soft'} block icon={<Trash2 className="h-5 w-5" />} onClick={remove}>
              {confirmDelete ? t('paystubs.confirmDelete') : t('paystubs.deleteStub')}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="flex gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-[13px] leading-snug text-ink-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          {t('paystubs.privacy')}
        </p>

        {active.length > 1 &&
          (active.length <= 3 ? (
            <div className="flex flex-col gap-1.5">
              <span className="px-1 text-sm font-medium text-ink-2">{t('paystubs.employer')}</span>
              <SegmentedControl ariaLabel={t('paystubs.employer')} options={active.map((e) => ({ value: e.id, label: e.name }))} value={v.employerId} onChange={onEmployer} />
            </div>
          ) : (
            <Select label={t('paystubs.employer')} value={v.employerId} onChange={(e) => onEmployer(e.target.value)} error={err('employerId')}>
              {active.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          ))}

        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={t('paystubs.periodStart')} value={v.periodStart} onChange={(e) => set('periodStart', e.target.value)} />
          <Input type="date" label={t('paystubs.periodEnd')} value={v.periodEnd} onChange={(e) => set('periodEnd', e.target.value)} />
        </div>
        {errors.period && <p className="-mt-3 px-1 text-sm font-medium text-danger">{t(errors.period)}</p>}
        <Input type="date" label={t('paystubs.payDate')} value={v.payDate} onChange={(e) => set('payDate', e.target.value)} error={err('payDate')} />

        <Group title={t('paystubs.sectionHours')}>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('paystubs.regularHours')} inputMode="decimal" suffix="h" placeholder="0" value={v.regularHours} onChange={(e) => set('regularHours', e.target.value)} error={err('regularHours')} numeric />
            <Input label={t('paystubs.overtimeHours')} inputMode="decimal" suffix="h" placeholder="0" value={v.overtimeHours} onChange={(e) => set('overtimeHours', e.target.value)} error={err('overtimeHours')} numeric />
          </div>
        </Group>

        <Group title={t('paystubs.sectionEarnings')}>
          {money('gross', t('paystubs.gross'), t('paystubs.grossHint'))}
          {money('tips', t('paystubs.tips'), t('paystubs.tipsHint'))}
        </Group>

        <Group title={t('paystubs.sectionTaxes')}>
          <div className="grid grid-cols-2 gap-3">
            {money('federalTax', t('paystubs.federalTax'))}
            {money('stateTax', t('paystubs.stateTax'))}
            {money('socialSecurity', t('paystubs.socialSecurity'))}
            {money('medicare', t('paystubs.medicare'))}
          </div>
          {money('otherDeductions', t('paystubs.otherDeductions'), t('paystubs.otherDeductionsHint'))}
          {money('net', t('paystubs.net'))}
        </Group>

        <Input label={t('paystubs.note')} placeholder={t('shiftForm.notePlaceholder')} value={v.note} maxLength={500} onChange={(e) => set('note', e.target.value)} />
      </div>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{title}</legend>
      {children}
    </fieldset>
  );
}
