import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAppConfig, useProfile } from '@/data/hooks';
import { saveProfile } from '@/data/repos/profile';
import { tap } from '@/shared/lib/haptics';
import { Button, Checkbox, Sheet } from '@/shared/ui';

/**
 * Se muestra a quien ya usa la app y todavía no aceptó la versión vigente de la política
 * (usuarios de antes de esta versión, o cuando la política cambia). No se puede cerrar sin aceptar.
 */
export function ConsentGate() {
  const profile = useProfile();
  const config = useAppConfig();
  const needs = !!profile?.onboardedAt && profile.consentVersion !== config.privacyPolicyVersion;
  return <ConsentSheet open={needs} version={config.privacyPolicyVersion} renewing={!!profile?.consentAt} />;
}

function ConsentSheet({ open, version, renewing }: { open: boolean; version: string; renewing: boolean }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);

  const accept = async () => {
    if (!checked) {
      tap('warning');
      return setError(true);
    }
    await saveProfile({ consentAt: Date.now(), consentVersion: version });
    tap('success');
  };

  return (
    <Sheet
      open={open}
      onClose={() => undefined}
      title={renewing ? t('consent.updatedTitle') : t('consent.title')}
      footer={
        <Button size="lg" block onClick={accept}>
          {t('consent.accept')}
        </Button>
      }
    >
      <div className="flex gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <p className="text-[14px] leading-snug text-ink-2">{t('consent.summary')}</p>
      </div>
      <div className="mt-4">
        <ConsentCheckbox checked={checked} onChange={(v) => (setChecked(v), setError(false))} error={error} />
      </div>
    </Sheet>
  );
}

/** Casilla obligatoria con link a la política (bienvenida, cuenta y aviso de cambios). */
export function ConsentCheckbox({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: boolean }) {
  const { t } = useTranslation();
  return (
    <div>
      <Checkbox checked={checked} onChange={onChange} error={error}>
        {t('consent.checkbox')}{' '}
        <Link to="/privacidad" className="font-semibold text-accent underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
          {t('consent.policyLink')}
        </Link>
      </Checkbox>
      {error && <p className="mt-1 px-1 text-[13px] text-danger">{t('consent.required')}</p>}
    </div>
  );
}
