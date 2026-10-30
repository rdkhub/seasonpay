import { useTranslation } from 'react-i18next';
import { BellRing, Check, Download, MoreVertical, PlusSquare, Share } from 'lucide-react';
import type { ReactNode } from 'react';
import { osLabel } from '@/shared/lib/device';
import { promptInstall, useCanInstall } from '@/shared/lib/installPrompt';
import { Button, Sheet } from '@/shared/ui';
import { installCase, iosSupportsWebPush } from './installGuide';

/** Guía paso a paso para instalar SeasonPay en la pantalla de inicio. */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const canInstall = useCanInstall();
  const c = installCase();
  const iosPush = iosSupportsWebPush();

  return (
    <Sheet open={open} onClose={onClose} title={t('install.title')} description={t('install.subtitle')}>
      {c === 'installed' && (
        <div className="flex items-center gap-3 rounded-2xl bg-positive/10 px-4 py-4 text-[15px] font-medium text-ink">
          <Check className="h-5 w-5 text-positive" /> {t('install.already')}
        </div>
      )}

      {c === 'ios_other_browser' && <p className="rounded-2xl bg-warn/10 px-4 py-3 text-[14px] leading-snug text-ink">{t('install.iosUseSafari')}</p>}

      {(c === 'ios_safari' || c === 'ios_other_browser') && (
        <>
          <ol className="mt-1 flex flex-col gap-3">
            <Step n={1} icon={<Share />} title={t('install.ios1')} body={t('install.ios1b')} />
            <Step n={2} icon={<PlusSquare />} title={t('install.ios2')} body={t('install.ios2b')} />
            <Step n={3} icon={<Check />} title={t('install.ios3')} body={t('install.ios3b')} />
          </ol>
          <div className="mt-4 flex gap-3 rounded-2xl bg-accent-soft px-4 py-3.5">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <p className="text-[14px] leading-snug text-ink">
              {t('install.iosPush')}{' '}
              {iosPush === false && <strong className="font-semibold">{t('install.iosTooOld', { os: osLabel() })}</strong>}
            </p>
          </div>
        </>
      )}

      {c === 'android' && (
        <>
          {canInstall ? (
            <Button size="lg" block icon={<Download className="h-5 w-5" />} onClick={() => void promptInstall().then((ok) => ok && onClose())}>
              {t('install.androidButton')}
            </Button>
          ) : (
            <ol className="flex flex-col gap-3">
              <Step n={1} icon={<MoreVertical />} title={t('install.android1')} body={t('install.android1b')} />
              <Step n={2} icon={<Download />} title={t('install.android2')} body={t('install.android2b')} />
            </ol>
          )}
          <p className="mt-4 text-[13px] leading-snug text-ink-3">{t('install.androidPush')}</p>
        </>
      )}

      {c === 'desktop' && <p className="text-[15px] leading-relaxed text-ink-2">{t('install.desktop', { url: window.location.origin })}</p>}
    </Sheet>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-3.5 rounded-2xl bg-surface-2 px-4 py-3.5">
      <span className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-semibold text-accent-ink">{n}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-ink [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:text-accent">
          {title} {icon}
        </span>
        <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">{body}</span>
      </span>
    </li>
  );
}
