import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { queueSurvey, type SurveyInput } from '@/data/repos/submissions';
import { cn } from '@/shared/lib/cn';
import { tap } from '@/shared/lib/haptics';
import { Button, Sheet, TextArea, useToast } from '@/shared/ui';

/** Opciones de cada pregunta. Deben coincidir con los CHECK de survey_responses (migración 0800). */
export const SURVEY_OPTIONS = {
  send_method: ['remittance_app', 'bank_wire', 'exchange_house', 'cash_trip', 'not_sending', 'other'],
  fx_loss_guess: ['lt1', '1to3', '3to5', 'gt5', 'unknown'],
  price_willing: ['free_only', 'usd1to3', 'usd4to7', 'usd8to12', 'gt12'],
  agency_include: ['yes', 'no', 'unsure'],
} as const;

type Q = keyof typeof SURVEY_OPTIONS;
type Answers = { [K in Q]: (typeof SURVEY_OPTIONS)[K][number] | null };

const EMPTY: Answers = { send_method: null, fx_loss_guess: null, price_willing: null, agency_include: null };

/** Encuesta corta de fin de temporada (4 preguntas + comentario opcional). */
export function SurveySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [a, setA] = useState<Answers>(EMPTY);
  const [comment, setComment] = useState('');
  const [missing, setMissing] = useState<Q[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setA(EMPTY);
      setComment('');
      setMissing([]);
    }
  }, [open]);

  const send = async () => {
    const miss = (Object.keys(SURVEY_OPTIONS) as Q[]).filter((q) => !a[q]);
    setMissing(miss);
    if (miss.length) {
      tap('warning');
      return;
    }
    setBusy(true);
    try {
      await queueSurvey({
        sendMethod: a.send_method!,
        fxLossGuess: a.fx_loss_guess!,
        priceWilling: a.price_willing!,
        agencyInclude: a.agency_include!,
        comment,
        lang: i18n.language.startsWith('en') ? 'en' : 'es',
      } as SurveyInput);
      tap('success');
      toast(t('survey.thanks'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('survey.title')}
      description={t('survey.subtitle')}
      footer={
        <Button size="lg" block loading={busy} onClick={send}>
          {t('survey.send')}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {(Object.keys(SURVEY_OPTIONS) as Q[]).map((q) => (
          <fieldset key={q}>
            <legend className="px-1 text-[15px] font-semibold text-ink">{t(`survey.q.${q}`)}</legend>
            <div role="radiogroup" className="mt-2.5 flex flex-wrap gap-2">
              {SURVEY_OPTIONS[q].map((opt) => {
                const on = a[q] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      tap();
                      setA((p) => ({ ...p, [q]: opt }));
                      setMissing((m) => m.filter((x) => x !== q));
                    }}
                    className={cn(
                      'min-h-[44px] rounded-full px-4 text-[14px] font-medium ring-1 transition-colors active:scale-95',
                      on ? 'bg-accent text-accent-ink ring-accent' : 'bg-surface-2 text-ink ring-transparent',
                    )}
                  >
                    {t(`survey.opt.${q}.${opt}`)}
                  </button>
                );
              })}
            </div>
            {missing.includes(q) && <p className="mt-1.5 px-1 text-[13px] text-danger">{t('survey.required')}</p>}
          </fieldset>
        ))}
        <TextArea label={t('survey.q.comment')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
        <p className="px-1 text-[12px] leading-snug text-ink-3">{t('survey.privacy')}</p>
      </div>
    </Sheet>
  );
}
