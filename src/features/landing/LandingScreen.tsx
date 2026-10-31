import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, Download, Lock, PiggyBank, Receipt, Send, ShieldCheck, Smartphone, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { applyLanguagePref, currentLang } from '@/shared/i18n';
import { isIos, promptInstall, useCanInstall } from '@/shared/lib/installPrompt';
import { Button, Card } from '@/shared/ui';
import { LogoMark } from '@/shared/ui/Logo';
import { LANDING_SEEN_KEY } from './landingSeen';

/** Página pública bilingüe: qué es SeasonPay, privacidad y cómo instalarla. */
export function LandingScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canInstall = useCanInstall();
  const ios = isIos();

  const start = () => {
    try {
      localStorage.setItem(LANDING_SEEN_KEY, '1');
    } catch {
      /* almacenamiento bloqueado */
    }
    navigate('/welcome');
  };

  const toggleLang = () => void applyLanguagePref(currentLang() === 'es' ? 'en' : 'es');

  return (
    <div className="pt-safe mx-auto min-h-dvh w-full max-w-lg px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between py-3">
        <span className="inline-flex items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <span className="text-[18px] font-semibold tracking-[-0.02em] text-ink">SeasonPay</span>
        </span>
        <button type="button" onClick={toggleLang} className="h-11 rounded-full px-4 text-[14px] font-semibold text-accent active:bg-accent-soft">
          {t('landing.language')}
        </button>
      </header>

      <section className="animate-rise-in pt-6">
        <span className="inline-flex h-7 items-center rounded-full bg-accent-soft px-3 text-[12px] font-semibold text-accent">{t('landing.badge')}</span>
        <h1 className="mt-4 text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">{t('landing.title')}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{t('landing.subtitle')}</p>
        <div className="mt-7 flex flex-col gap-2.5">
          <Button size="xl" block trailingIcon={<ArrowRight className="h-5 w-5" />} onClick={start}>
            {t('landing.cta')}
          </Button>
          {canInstall && (
            <Button size="lg" variant="secondary" block icon={<Download className="h-5 w-5" />} onClick={() => void promptInstall()}>
              {t('landing.install')}
            </Button>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-3">
        <Feature icon={<Timer />} title={t('landing.f1Title')} body={t('landing.f1Body')} />
        <Feature icon={<Receipt />} title={t('landing.f2Title')} body={t('landing.f2Body')} />
        <Feature icon={<ShieldCheck />} title={t('landing.f3Title')} body={t('landing.f3Body')} />
        <Feature icon={<PiggyBank />} title={t('landing.f4Title')} body={t('landing.f4Body')} />
        <Feature icon={<CalendarClock />} title={t('landing.f5Title')} body={t('landing.f5Body')} />
        <Feature icon={<Send />} title={t('landing.f6Title')} body={t('landing.f6Body')} />
      </section>

      <Card tone="hero" className="mt-6 p-6">
        <Lock className="h-6 w-6 text-white/90" />
        <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-white">{t('landing.privacyTitle')}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">{t('landing.privacyBody')}</p>
      </Card>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
          <Smartphone className="h-5 w-5 text-accent" /> {t('landing.installTitle')}
        </h2>
        <div className="mt-3 grid gap-3">
          {/* Primero el sistema del celular que está viendo la página. */}
          {(ios ? ['ios', 'android'] : ['android', 'ios']).map((k) => (
            <Card key={k} className="p-4">
              <p className="text-[15px] font-semibold text-ink">{t(`landing.${k}Title`)}</p>
              <p className="mt-1 text-[14px] leading-snug text-ink-2">{t(`landing.${k}Steps`)}</p>
            </Card>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-[12px] leading-snug text-ink-3">{t('landing.disclaimer')}</p>
      <div className="mt-5">
        <Button size="lg" block onClick={start}>
          {t('landing.cta')}
        </Button>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card className="flex gap-3.5 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <span>
        <span className="block text-[16px] font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-[14px] leading-snug text-ink-2">{body}</span>
      </span>
    </Card>
  );
}
