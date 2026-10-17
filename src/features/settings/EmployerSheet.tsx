import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Archive, ExternalLink, Info } from 'lucide-react';
import type { EmployerRow } from '@/data/db';
import { useProfile, useRules } from '@/data/hooks';
import { archiveEmployer, createEmployer, updateEmployer } from '@/data/repos/employers';
import { overtimeDefaults } from '@/data/repos/rules';
import { formatDateISO } from '@/shared/lib/format';
import { tap } from '@/shared/lib/haptics';
import { stateName } from '@/shared/lib/usStates';
import { Button, Sheet, useToast } from '@/shared/ui';
import { EmployerFields } from './EmployerFields';
import { employerToForm, emptyEmployerForm, validateEmployerForm, type EmployerFormErrors } from './employerForm';

interface EmployerSheetProps {
  open: boolean;
  onClose: () => void;
  employer: EmployerRow | null;
}

export function EmployerSheet({ open, onClose, employer }: EmployerSheetProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const profile = useProfile();
  const rules = useRules();
  const [value, setValue] = useState(() => emptyEmployerForm());
  const [errors, setErrors] = useState<EmployerFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (employer) setValue(employerToForm(employer));
    else void overtimeDefaults(profile?.workState ?? null).then((ot) => setValue(emptyEmployerForm(ot)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employer?.id]);

  // Aviso oficial sobre la exención de temporada (dato de tax_rules, no texto fijo con cifras).
  const notice = rules?.find((r) => r.key === 'overtime_seasonal_exemption_notice');
  // Aviso estatal para estudiantes en negocios recreativos de temporada (por ahora, Montana).
  const stateNotice = rules?.find((r) => r.key === 'overtime_seasonal_student_notice' && r.jurisdiction === profile?.workState);
  const stateThreshold = (stateNotice?.value as { threshold_hours?: number } | undefined)?.threshold_hours;

  const save = async () => {
    const { errors: e, draft } = validateEmployerForm(value, true);
    setErrors(e);
    if (!draft) return tap('warning');
    if (employer) await updateEmployer(employer.id, draft);
    else await createEmployer(draft, profile?.workState ?? null);
    tap('success');
    toast(t('employer.saved'));
    onClose();
  };

  const toggleArchive = async () => {
    if (!employer) return;
    await archiveEmployer(employer.id, !employer.archived);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={employer ? t('employer.editTitle') : t('employer.newTitle')}
      footer={
        <div className="flex flex-col gap-2.5">
          <Button size="lg" block onClick={save}>
            {t('common.save')}
          </Button>
          {employer && (
            <Button variant="ghost" block icon={<Archive className="h-5 w-5" />} onClick={toggleArchive}>
              {employer.archived ? t('employer.unarchive') : t('employer.archive')}
            </Button>
          )}
        </div>
      }
    >
      <EmployerFields value={value} onChange={setValue} errors={errors} />

      {notice && value.overtimeEnabled && (
        <div className="mt-5 rounded-2xl bg-warn/10 p-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <AlertTriangle className="h-5 w-5 text-warn" />
            {t('employer.overtimeNoticeTitle')}
          </div>
          <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{t('employer.overtimeNoticeBody')}</p>
          <a href={notice.sourceUrl} target="_blank" rel="noreferrer" className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
            {t('common.source')}: DOL Fact Sheet #18 <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <p className="mt-1 text-[12px] text-ink-3">{t('common.verifiedOn', { date: formatDateISO(notice.verifiedAt, i18n.language) })}</p>
        </div>
      )}
      {stateNotice && value.overtimeEnabled && typeof stateThreshold === 'number' && (
        <div className="mt-3 rounded-2xl bg-accent-soft p-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Info className="h-5 w-5 text-accent" />
            {t('employer.stateStudentNoticeTitle', { state: stateName(stateNotice.jurisdiction) })}
          </div>
          <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{t('employer.stateStudentNoticeBody', { hours: stateThreshold })}</p>
          <a href={stateNotice.sourceUrl} target="_blank" rel="noreferrer" className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
            {t('common.source')}: MCA 39-3-405(3) <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <p className="mt-1 text-[12px] text-ink-3">{t('common.verifiedOn', { date: formatDateISO(stateNotice.verifiedAt, i18n.language) })}</p>
          {value.threshold !== String(stateThreshold) && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setValue({ ...value, threshold: String(stateThreshold) })}>
              {t('employer.useThreshold', { hours: stateThreshold })}
            </Button>
          )}
        </div>
      )}
      {employer && <p className="mt-4 px-1 text-[13px] text-ink-3">{t('employer.archiveHint')}</p>}
    </Sheet>
  );
}
