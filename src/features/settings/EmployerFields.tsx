import { useTranslation } from 'react-i18next';
import { PAY_FREQUENCIES, type EmployerFormErrors, type EmployerFormValue } from './employerForm';
import { Input, Select, SegmentedControl, Toggle } from '@/shared/ui';

interface EmployerFieldsProps {
  value: EmployerFormValue;
  onChange: (v: EmployerFormValue) => void;
  errors?: EmployerFormErrors;
  /** compact = solo nombre, tarifa y frecuencia (onboarding) */
  compact?: boolean;
}

export function EmployerFields({ value, onChange, errors = {}, compact }: EmployerFieldsProps) {
  const { t } = useTranslation();
  const set = <K extends keyof EmployerFormValue>(k: K, v: EmployerFormValue[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-col gap-5">
      <Input
        label={t('employer.name')}
        placeholder={t('employer.namePlaceholder')}
        value={value.name}
        maxLength={120}
        autoComplete="organization"
        onChange={(e) => set('name', e.target.value)}
        error={errors.name ? t(errors.name) : undefined}
      />
      <Input
        label={t('employer.rate')}
        hint={t('employer.rateHint')}
        prefix="$"
        suffix={t('common.perHour')}
        inputMode="decimal"
        placeholder="15.00"
        value={value.rate}
        onChange={(e) => set('rate', e.target.value)}
        error={errors.rate ? t(errors.rate) : undefined}
        numeric
      />
      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-medium text-ink-2">{t('employer.frequency')}</span>
        <SegmentedControl
          ariaLabel={t('employer.frequency')}
          columns={2}
          options={PAY_FREQUENCIES.map((f) => ({ value: f, label: t(`payFrequency.${f}`) }))}
          value={value.payFrequency}
          onChange={(v) => set('payFrequency', v)}
        />
      </div>

      {!compact && (
        <>
          <Select
            label={t('employer.workweekStart')}
            hint={t('employer.workweekStartHint')}
            value={value.workweekStartDay}
            onChange={(e) => set('workweekStartDay', Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <option key={d} value={d}>
                {t(`weekday.${d}`)}
              </option>
            ))}
          </Select>

          <div className="rounded-2xl bg-surface-2 px-4 py-1">
            <Toggle
              checked={value.overtimeEnabled}
              onChange={(v) => set('overtimeEnabled', v)}
              label={t('employer.overtime')}
              description={
                value.overtimeEnabled
                  ? value.daily
                    ? t('employer.overtimeOnDaily', { hours: value.threshold || '—', daily: value.daily, mult: value.multiplier || '—' })
                    : t('employer.overtimeOn', { hours: value.threshold || '—', mult: value.multiplier || '—' })
                  : t('employer.overtimeOff')
              }
            />
          </div>
          {value.overtimeEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('employer.threshold')}
                inputMode="decimal"
                suffix="h"
                value={value.threshold}
                onChange={(e) => set('threshold', e.target.value)}
                error={errors.threshold ? ' ' : undefined}
                numeric
              />
              <Input
                label={t('employer.multiplier')}
                inputMode="decimal"
                suffix="x"
                value={value.multiplier}
                onChange={(e) => set('multiplier', e.target.value)}
                error={errors.multiplier ? ' ' : undefined}
                numeric
              />
              <Input
                className="col-span-2"
                label={t('employer.daily')}
                hint={t('employer.dailyHint')}
                inputMode="decimal"
                suffix={t('employer.dailySuffix')}
                placeholder="—"
                value={value.daily}
                onChange={(e) => set('daily', e.target.value)}
                error={errors.daily ? t(errors.daily) : undefined}
                numeric
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
