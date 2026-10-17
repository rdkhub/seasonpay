import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import type { LanguagePref, VisaType } from '@/data/db';
import { createEmployer } from '@/data/repos/employers';
import { saveProfile } from '@/data/repos/profile';
import { EmployerFields } from '@/features/settings/EmployerFields';
import { emptyEmployerForm, validateEmployerForm, type EmployerFormErrors } from '@/features/settings/employerForm';
import { applyLanguagePref, deviceLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';
import { Button, OptionList } from '@/shared/ui';
import { LogoMark } from '@/shared/ui/Logo';
import { StateSelect, VisaFields } from './ProfileFields';
import { AuthSheet } from '@/features/account/AuthSheet';
import { authAvailable } from '@/data/sync/auth';

const TOTAL = 3;

export function OnboardingScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<'es' | 'en'>(() => deviceLanguage());
  const [visaType, setVisaType] = useState<VisaType | null>(null);
  const [arrivalYear, setArrivalYear] = useState(() => new Date().getFullYear());
  const [workState, setWorkState] = useState<string | null>(null);
  const [employer, setEmployer] = useState(() => emptyEmployerForm());
  const [errors, setErrors] = useState<EmployerFormErrors & { state?: string }>({});
  const [saving, setSaving] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const chooseLang = (l: 'es' | 'en') => {
    setLang(l);
    void applyLanguagePref(l);
  };

  const canContinue = step === 0 ? true : step === 1 ? visaType !== null : true;

  const finish = async () => {
    const { errors: e, draft } = validateEmployerForm(employer, false);
    const all = { ...e, ...(workState ? {} : { state: 'onboarding.statePlaceholder' }) };
    setErrors(all);
    if (!draft || !workState) {
      tap('warning');
      return;
    }
    setSaving(true);
    try {
      // Si el usuario eligió el mismo idioma del celular, lo guardamos como "del celular".
      const pref: LanguagePref = lang === deviceLanguage() ? 'system' : lang;
      await createEmployer(draft, workState);
      await saveProfile({ language: pref, visaType, arrivalYear, workState, onboardedAt: Date.now() });
      tap('success');
      navigate('/', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < TOTAL - 1) {
      tap();
      setStep((s) => s + 1);
    } else void finish();
  };

  return (
    <div className="pt-safe mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5">
      {/* Progreso */}
      <div className="flex items-center gap-3 pb-2 pt-3">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-accent' : 'bg-line')} />
          ))}
        </div>
        <span className="tnum text-[13px] font-medium text-ink-3">{t('onboarding.step', { n: step + 1, total: TOTAL })}</span>
      </div>

      <div key={step} className="flex-1 animate-rise-in pb-6 pt-6">
        {step === 0 && (
          <>
            <LogoMark className="h-16 w-16" />
            <h1 className="mt-6 text-hero text-ink">{t('onboarding.welcomeTitle')}</h1>
            <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{t('onboarding.welcomeBody')}</p>
            <h2 className="mb-3 mt-9 text-[19px] font-semibold tracking-[-0.01em] text-ink">{t('onboarding.languageTitle')}</h2>
            <OptionList
              ariaLabel={t('onboarding.languageTitle')}
              value={lang}
              onChange={chooseLang}
              options={[
                { value: 'es', label: 'Español', icon: 'ES' },
                { value: 'en', label: 'English', icon: 'EN' },
              ]}
            />
            <p className="mt-3 px-1 text-[13px] text-ink-3">{t('onboarding.languageBody')}</p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-hero text-ink">{t('onboarding.visaTitle')}</h1>
            <p className="mb-6 mt-3 text-[16px] leading-relaxed text-ink-2">{t('onboarding.visaBody')}</p>
            <VisaFields visaType={visaType} arrivalYear={arrivalYear} onVisa={setVisaType} onYear={setArrivalYear} />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-hero text-ink">{t('onboarding.workTitle')}</h1>
            <p className="mb-6 mt-3 text-[16px] leading-relaxed text-ink-2">{t('onboarding.workBody')}</p>
            <div className="flex flex-col gap-5">
              <StateSelect value={workState} onChange={setWorkState} error={errors.state ? t(errors.state) : undefined} />
              <EmployerFields value={employer} onChange={setEmployer} errors={errors} compact />
            </div>
          </>
        )}
      </div>

      {/* Si ya tenía cuenta, al entrar baja su perfil y el router lo lleva a la app. */}
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Acciones abajo, al alcance del pulgar */}
      <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-bg from-75% to-transparent px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
        <div className="flex gap-2.5">
          {step > 0 && (
            <Button variant="secondary" size="lg" aria-label={t('common.back')} onClick={() => setStep((s) => s - 1)} className="w-16 shrink-0 px-0">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          )}
          <Button size="lg" block onClick={next} disabled={!canContinue} loading={saving} trailingIcon={step < TOTAL - 1 ? <ArrowRight className="h-5 w-5" /> : undefined}>
            {step < TOTAL - 1 ? t('common.continue') : t('onboarding.finish')}
          </Button>
        </div>
        {step === 0 && authAvailable() && (
          <button type="button" onClick={() => setAuthOpen(true)} className="mt-2 h-11 w-full text-center text-[14px] font-semibold text-accent">
            {t('account.haveAccount')}
          </button>
        )}
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-ink-3">
          <Lock className="h-3.5 w-3.5" /> {t('onboarding.privacyNote')}
        </p>
      </div>
    </div>
  );
}
