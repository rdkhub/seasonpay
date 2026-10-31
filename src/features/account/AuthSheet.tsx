import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react';
import {
  emailAuthEnabled,
  googleAuthEnabled,
  sendEmailCode,
  signInWithGoogle,
  signInWithUsername,
  signUpWithUsername,
  verifyEmailCode,
  type AuthError,
  type PasswordAuthError,
} from '@/data/sync/auth';
import { syncNow } from '@/data/sync/syncEngine';
import { normalizeUsername, passwordOk, usernameProblem, PASSWORD_MIN } from '@/domain/username';
import { tap } from '@/shared/lib/haptics';
import { Button, Input, SegmentedControl, Sheet, useToast } from '@/shared/ui';
import { useProfile } from '@/data/hooks';
import { ConsentCheckbox } from '@/features/privacy/ConsentSheet';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

type Mode = 'signup' | 'signin' | 'email' | 'code';
type FieldError = 'username_short' | 'username_long' | 'username_chars' | 'password_short' | 'password_mismatch' | 'email';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Con qué pestaña abre. En la bienvenida ("¿Ya usas SeasonPay?") abre en "Entrar". */
  initialMode?: 'signup' | 'signin';
  /** Se llama cuando la sesión quedó lista y terminó la primera sincronización */
  onSignedIn?: () => void;
}

/**
 * Cuenta con usuario y contraseña (sin correo). La cuenta la crea la Edge Function create-user.
 * El ingreso por código al correo queda detrás de VITE_EMAIL_AUTH para cuando haya SMTP propio.
 */
export function AuthSheet({ open, onClose, initialMode = 'signup', onSignedIn }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [error, setError] = useState<PasswordAuthError | AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const profile = useProfile();
  // Crear cuenta exige aceptar la política. Si ya la aceptó en la bienvenida, no se repite.
  const needsConsent = !profile?.consentAt;
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setPassword('');
      setPassword2('');
      setShowPw(false);
      setCode('');
      setFieldError(null);
      setError(null);
      setConsent(false);
      setConsentError(false);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const finish = async () => {
    await syncNow();
    setBusy(false);
    tap('success');
    toast(t('account.welcomeBack'));
    onSignedIn?.();
    onClose();
  };

  const fail = (f: FieldError | null, e: PasswordAuthError | AuthError | null = null) => {
    tap('warning');
    setFieldError(f);
    setError(e);
  };

  const submitPassword = async () => {
    const u = normalizeUsername(username);
    const problem = usernameProblem(u);
    if (mode === 'signup' && problem) return fail(`username_${problem}`);
    if (mode === 'signin' && !u) return fail('username_short');
    if (mode === 'signup' && !passwordOk(password)) return fail('password_short');
    if (mode === 'signin' && !password) return fail('password_short');
    if (mode === 'signup' && password !== password2) return fail('password_mismatch');
    if (mode === 'signup' && needsConsent && !consent) {
      tap('warning');
      return setConsentError(true);
    }
    setBusy(true);
    setFieldError(null);
    setError(null);
    const err = mode === 'signup' ? await signUpWithUsername(u, password) : await signInWithUsername(u, password);
    if (err) {
      setBusy(false);
      return fail(null, err);
    }
    setUsername(u);
    await finish();
  };

  const sendCode = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return fail('email');
    if (needsConsent && !consent) {
      tap('warning');
      return setConsentError(true);
    }
    setBusy(true);
    setFieldError(null);
    setError(null);
    const err = await sendEmailCode(e);
    setBusy(false);
    if (err) return fail(null, err);
    setEmail(e);
    setMode('code');
    setWait(RESEND_SECONDS);
  };

  const verify = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length < 6) return fail(null, 'invalid_code');
    setBusy(true);
    setError(null);
    const err = await verifyEmailCode(email, c);
    if (err) {
      setBusy(false);
      return fail(null, err);
    }
    await finish();
  };

  const isPassword = mode === 'signup' || mode === 'signin';
  const fieldMsg = (f: FieldError) => (fieldError === f ? t(`account.fieldErrors.${f}`) : undefined);
  const usernameError =
    fieldMsg('username_short') ?? fieldMsg('username_long') ?? fieldMsg('username_chars');

  const title =
    mode === 'signup' ? t('account.signupTitle') : mode === 'signin' ? t('account.signinTitle') : mode === 'email' ? t('account.sheetTitle') : t('account.codeTitle');
  const description =
    mode === 'signup' ? t('account.signupBody') : mode === 'signin' ? t('account.signinBody') : mode === 'email' ? t('account.sheetBody') : t('account.codeBody', { email });

  const pwToggle = (
    <button
      type="button"
      aria-label={showPw ? t('account.hidePassword') : t('account.showPassword')}
      onClick={() => setShowPw((v) => !v)}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-3 active:bg-surface-2"
    >
      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        isPassword ? (
          <Button size="lg" block onClick={submitPassword} loading={busy}>
            {mode === 'signup' ? t('account.createAccount') : t('account.verify')}
          </Button>
        ) : mode === 'email' ? (
          <Button size="lg" block icon={<Mail className="h-5 w-5" />} onClick={sendCode} loading={busy}>
            {t('account.sendCode')}
          </Button>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Button size="lg" block onClick={verify} loading={busy}>
              {t('account.verify')}
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setMode('email')}>
                {t('account.changeEmail')}
              </Button>
              <Button variant="ghost" disabled={wait > 0 || busy} onClick={sendCode}>
                {wait > 0 ? t('account.resendIn', { s: wait }) : t('account.resend')}
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {isPassword && (
          <>
            <SegmentedControl
              ariaLabel={t('account.section')}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setFieldError(null);
                setError(null);
              }}
              options={[
                { value: 'signup', label: t('account.tabSignup') },
                { value: 'signin', label: t('account.tabSignin') },
              ]}
            />
            <Input
              label={t('account.username')}
              placeholder={t('account.usernamePlaceholder')}
              hint={mode === 'signup' ? t('account.usernameHint') : undefined}
              error={usernameError}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={21}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <Input
              type={showPw ? 'text' : 'password'}
              label={t('account.password')}
              hint={mode === 'signup' ? t('account.passwordHint', { n: PASSWORD_MIN }) : undefined}
              error={fieldMsg('password_short')}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && mode === 'signin' && void submitPassword()}
              suffix={pwToggle}
            />
            {mode === 'signup' && (
              <>
                <Input
                  type={showPw ? 'text' : 'password'}
                  label={t('account.password2')}
                  error={fieldMsg('password_mismatch')}
                  autoComplete="new-password"
                  maxLength={72}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submitPassword()}
                />
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">{t('account.noRecovery')}</p>
                {needsConsent && <ConsentCheckbox checked={consent} onChange={(v) => (setConsent(v), setConsentError(false))} error={consentError} />}
              </>
            )}
            {(emailAuthEnabled() || googleAuthEnabled()) && (
              <div className="flex items-center gap-3 text-[13px] text-ink-3">
                <span className="h-px flex-1 bg-line" />
                {t('account.or')}
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            {emailAuthEnabled() && (
              <Button variant="secondary" size="lg" block icon={<Mail className="h-5 w-5" />} onClick={() => (setMode('email'), setError(null))}>
                {t('account.useEmail')}
              </Button>
            )}
            {googleAuthEnabled() && (
              <Button
                variant="secondary"
                size="lg"
                block
                onClick={() => {
                  if (needsConsent && !consent) {
                    tap('warning');
                    return setConsentError(true);
                  }
                  void signInWithGoogle();
                }}
              >
                {t('account.google')}
              </Button>
            )}
          </>
        )}

        {mode === 'email' && (
          <>
            <Input
              type="email"
              label={t('account.email')}
              placeholder={t('account.emailPlaceholder')}
              error={fieldMsg('email')}
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void sendCode()}
              autoFocus
            />
            {needsConsent && <ConsentCheckbox checked={consent} onChange={(v) => (setConsent(v), setConsentError(false))} error={consentError} />}
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => (setMode('signin'), setError(null))}>
              {t('account.backToUsername')}
            </Button>
          </>
        )}

        {mode === 'code' && (
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
