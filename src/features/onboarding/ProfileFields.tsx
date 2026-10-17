import { useTranslation } from 'react-i18next';
import type { VisaType } from '@/data/db';
import { US_STATES } from '@/shared/lib/usStates';
import { OptionList, Select, Stepper } from '@/shared/ui';
import { VISA_TYPES } from './visaTypes';

const VISA_ICON: Record<VisaType, string> = {
  j1_student: '🎓',
  j1_other: '🌎',
  h2b: '🛠️',
  other: '📄',
};

export function VisaFields({
  visaType,
  arrivalYear,
  onVisa,
  onYear,
}: {
  visaType: VisaType | null;
  arrivalYear: number;
  onVisa: (v: VisaType) => void;
  onYear: (y: number) => void;
}) {
  const { t } = useTranslation();
  const thisYear = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-6">
      <OptionList
        ariaLabel={t('onboarding.visaLabel')}
        value={visaType}
        onChange={onVisa}
        options={VISA_TYPES.map((v) => ({ value: v, label: t(`visa.${v}`), description: t(`visaHint.${v}`), icon: VISA_ICON[v] }))}
      />
      <Stepper label={t('onboarding.arrivalYear')} hint={t('onboarding.arrivalYearHint')} value={arrivalYear} onChange={onYear} min={thisYear - 15} max={thisYear + 1} />
    </div>
  );
}

export function StateSelect({ value, onChange, error }: { value: string | null; onChange: (code: string) => void; error?: string }) {
  const { t } = useTranslation();
  return (
    <Select label={t('onboarding.state')} value={value ?? ''} onChange={(e) => onChange(e.target.value)} error={error}>
      <option value="" disabled>
        {t('onboarding.statePlaceholder')}
      </option>
      {US_STATES.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
