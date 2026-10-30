import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAppConfig } from '@/data/hooks';
import { applyLanguagePref, currentLang } from '@/shared/i18n';
import { formatDateISO } from '@/shared/lib/format';

/** Orden de las secciones (los textos viven en i18n: privacyPolicy.sections.<id>). */
export const POLICY_SECTIONS = ['who', 'data', 'never', 'feedback', 'metrics', 'push', 'purpose', 'sharing', 'rights', 'transfer', 'thirdParties', 'tax', 'changes', 'contact'] as const;

/** Política de privacidad pública (/privacidad), bilingüe. */
export function PrivacyScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const config = useAppConfig();

  return (
    <div className="pt-safe mx-auto min-h-dvh w-full max-w-lg px-5 pb-[max(32px,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between py-2">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-ink-2 active:bg-surface-2"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => void applyLanguagePref(currentLang() === 'es' ? 'en' : 'es')}
          className="h-11 rounded-full px-4 text-[14px] font-semibold text-accent active:bg-accent-soft"
        >
          {t('landing.language')}
        </button>
      </header>
      <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink">{t('privacyPolicy.title')}</h1>
      <p className="mt-2 text-[13px] text-ink-3">{t('privacyPolicy.updated', { date: formatDateISO(config.privacyPolicyVersion, i18n.language) })}</p>
      <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{t('privacyPolicy.intro')}</p>
      {POLICY_SECTIONS.map((id) => (
        <section key={id} className="mt-7">
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">{t(`privacyPolicy.sections.${id}.title`)}</h2>
          {t(`privacyPolicy.sections.${id}.body`)
            .split('\n')
            .map((para, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink-2">
                {para}
              </p>
            ))}
        </section>
      ))}
    </div>
  );
}
