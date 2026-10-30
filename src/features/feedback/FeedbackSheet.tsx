import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Star } from 'lucide-react';
import { useAppConfig } from '@/data/hooks';
import { queueFeedback } from '@/data/repos/submissions';
import { cn } from '@/shared/lib/cn';
import { osLabel } from '@/shared/lib/device';
import { tap } from '@/shared/lib/haptics';
import { useOnline } from '@/shared/lib/useOnline';
import { Button, Sheet, TextArea, Toggle, useToast } from '@/shared/ui';
import { closeFeedback, useFeedbackState } from './feedbackStore';

/** Formulario corto: calificación, qué falló, qué te gustaría y captura opcional. */
export function FeedbackSheet() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const config = useAppConfig();
  const { open, screen, screenshot } = useFeedbackState();
  const [rating, setRating] = useState(0);
  const [whatFailed, setWhatFailed] = useState('');
  const [wish, setWish] = useState('');
  const [attach, setAttach] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setWhatFailed('');
    setWish('');
    setAttach(false);
    setError(false);
  }, [open]);

  const send = async () => {
    if (rating < 1) {
      tap('warning');
      return setError(true);
    }
    setBusy(true);
    try {
      await queueFeedback({
        rating,
        whatFailed,
        wish,
        screenshot: attach ? screenshot : null,
        os: osLabel(),
        screen,
        lang: i18n.language.startsWith('en') ? 'en' : 'es',
      });
      tap('success');
      toast(online ? t('feedback.sent') : t('feedback.queued'));
      closeFeedback();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={closeFeedback}
      title={t('feedback.title')}
      description={t('feedback.subtitle')}
      footer={
        <Button size="lg" block loading={busy} onClick={send}>
          {t('feedback.send')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="px-1 text-sm font-medium text-ink-2">{t('feedback.rating')}</p>
          <div role="radiogroup" aria-label={t('feedback.rating')} className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t('feedback.stars', { count: n })}
                onClick={() => {
                  tap();
                  setRating(n);
                  setError(false);
                }}
                className="grid h-12 w-12 place-items-center rounded-2xl active:scale-90"
              >
                <Star className={cn('h-8 w-8 transition-colors', n <= rating ? 'fill-warn text-warn' : 'text-line')} strokeWidth={1.75} />
              </button>
            ))}
          </div>
          {error && <p className="mt-1 px-1 text-[13px] text-danger">{t('feedback.ratingRequired')}</p>}
        </div>
        <TextArea label={t('feedback.whatFailed')} placeholder={t('feedback.whatFailedPh')} value={whatFailed} onChange={(e) => setWhatFailed(e.target.value)} maxLength={2000} />
        <TextArea label={t('feedback.wish')} placeholder={t('feedback.wishPh')} value={wish} onChange={(e) => setWish(e.target.value)} maxLength={2000} />
        {screenshot && (
          <div>
            <Toggle checked={attach} onChange={setAttach} label={t('feedback.attach')} description={t('feedback.attachHint')} />
            {attach && <img src={screenshot} alt={t('feedback.preview')} className="mx-auto mt-3 max-h-64 rounded-xl ring-1 ring-line" />}
          </div>
        )}
        <p className="px-1 text-[12px] leading-snug text-ink-3">{t('feedback.meta', { version: __APP_VERSION__, os: osLabel(), screen })}</p>
        {config.whatsappGroupUrl && (
          <a
            href={config.whatsappGroupUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-surface-2 text-[15px] font-semibold text-ink active:scale-[0.98]"
          >
            <MessageCircle className="h-5 w-5 text-positive" /> {t('feedback.whatsapp')}
          </a>
        )}
      </div>
    </Sheet>
  );
}
