import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail } from 'lucide-react';
import { googleAuthEnabled, sendEmailCode, signInWithGoogle, verifyEmailCode, type AuthError } from '@/data/sync/auth';
import { syncNow } from '@/data/sync/syncEngine';
import { tap } from '@/shared/lib/haptics';
import { Button, Input, Sheet, useToast } from '@/shared/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Se llama cuando la sesión quedó lista y terminó la primera sincronización */
  onSignedIn?: () => void;
}

/** Login sin contraseña: código de un solo uso por correo (funciona dentro de la app instalada). */
export function AuthSheet({ open, onClose, onSignedIn }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<AuthError | 'email' | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (open) {
      setStep('email');
      setCode('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      tap('warning');
      return setError('email');
    }
    setBusy(true);
    setError(null);
    const err = await sendEmailCode(e);
    setBusy(false);
    if (err) {
      tap('warning');
      return setError(err);
    }
    setEmail(e);
    setStep('code');
    setWait(RESEND_SECONDS);
  };

  const verify = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length < 6) {
      tap('warning');
      return setError('invalid_code');
    }
    setBusy(true);
    setError(null);
    const err = await verifyEmailCode(email, c);
    if (err) {
      setBusy(false);
      tap('warning');
      return setError(err);
    }
    await syncNow();
    setBusy(false);
    tap('success');
    toast(t('account.welcomeBack'));
    onSignedIn?.();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step === 'email' ? t('account.sheetTitle') : t('account.codeTitle')}
      description={step === 'email' ? t('account.sheetBody') : t('account.codeBody', { email })}
      footer={
        step === 'email' ? (
          <Button size="lg" block icon={<Mail className="h-5 w-5" />} onClick={send} loading={busy}>
            {t('account.sendCode')}
          </Button>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Button size="lg" block onClick={verify} loading={busy}>
              {t('account.verify')}
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep('email')}>
                {t('account.changeEmail')}
              </Button>
              <Button variant="ghost" disabled={wait > 0 || busy} onClick={send}>
                {wait > 0 ? t('account.resendIn', { s: wait }) : t('account.resend')}
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {step === 'email' ? (
          <>
            <Input
              type="email"
              label={t('account.email')}
              placeholder={t('account.emailPlaceholder')}
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
              autoFocus
            />
            {googleAuthEnabled() && (
              <>
                <div className="flex items-center gap-3 text-[13px] text-ink-3">
                  <span className="h-px flex-1 bg-line" />
                  {t('account.or')}
                  <span className="h-px flex-1 bg-line" />
                </div>
                <Button variant="secondary" size="lg" block onClick={() => void signInWithGoogle()}>
                  {t('account.google')}
                </Button>
              </>
            )}
          </>
        ) : (
          <Input
            label={t('account.code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && void verify()}
            className="[&_input]:text-center [&_input]:text-[26px] [&_input]:tracking-[0.35em]"
            numeric
            autoFocus
          />
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger">
            {t(`account.errors.${error}`)}
          </p>
        )}
      </div>
    </Sheet>
  );
}
