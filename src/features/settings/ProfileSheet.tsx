import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfileRow, VisaType } from '@/data/db';
import { saveProfile } from '@/data/repos/profile';
import { StateSelect, VisaFields } from '@/features/onboarding/ProfileFields';
import { tap } from '@/shared/lib/haptics';
import { Button, Sheet, useToast } from '@/shared/ui';

export function ProfileSheet({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: ProfileRow | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [visaType, setVisaType] = useState<VisaType | null>(null);
  const [arrivalYear, setArrivalYear] = useState(new Date().getFullYear());
  const [workState, setWorkState] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile) return;
    setVisaType(profile.visaType);
    setArrivalYear(profile.arrivalYear ?? new Date().getFullYear());
    setWorkState(profile.workState);
  }, [open, profile]);

  const save = async () => {
    await saveProfile({ visaType, arrivalYear, workState });
    tap('success');
    toast(t('settings.profileSaved'));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('settings.profileTitle')}
      footer={
        <Button size="lg" block onClick={save} disabled={!visaType || !workState}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <VisaFields visaType={visaType} arrivalYear={arrivalYear} onVisa={setVisaType} onYear={setArrivalYear} />
        <StateSelect value={workState} onChange={setWorkState} />
      </div>
    </Sheet>
  );
}
