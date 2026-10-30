import { db } from '../db';
import { getInstallId } from '../install';
import { getSupabase } from '../sync/supabaseClient';
import { track } from '../telemetry';
import { APP_VERSION } from '@/shared/lib/device';

/**
 * Feedback y encuesta: se guardan en el celular y se envían cuando hay señal.
 * Van a tablas de Supabase donde la app solo puede insertar; solo el admin las lee.
 */

export interface FeedbackInput {
  rating: number;
  whatFailed: string;
  wish: string;
  screenshot: string | null;
  os: string;
  screen: string;
  lang: 'es' | 'en';
}

export interface SurveyInput {
  sendMethod: 'remittance_app' | 'bank_wire' | 'cash_trip' | 'exchange_house' | 'not_sending' | 'other';
  fxLossGuess: 'lt1' | '1to3' | '3to5' | 'gt5' | 'unknown';
  priceWilling: 'free_only' | 'usd1to3' | 'usd4to7' | 'usd8to12' | 'gt12';
  agencyInclude: 'yes' | 'no' | 'unsure';
  comment: string;
  lang: 'es' | 'en';
}

export async function queueFeedback(f: FeedbackInput): Promise<void> {
  await db.pending.add({
    id: crypto.randomUUID(),
    kind: 'feedback',
    createdAt: Date.now(),
    payload: {
      rating: Math.min(5, Math.max(1, Math.round(f.rating))),
      what_failed: f.whatFailed.trim().slice(0, 2000),
      wish: f.wish.trim().slice(0, 2000),
      screenshot: f.screenshot,
      app_version: APP_VERSION,
      os: f.os.slice(0, 60),
      screen: f.screen.slice(0, 80),
      lang: f.lang,
    },
  });
  await track('feedback_sent', { screen: f.screen.slice(0, 40) });
  void flushPending();
}

export async function queueSurvey(s: SurveyInput): Promise<void> {
  await db.pending.add({
    id: crypto.randomUUID(),
    kind: 'survey',
    createdAt: Date.now(),
    payload: {
      send_method: s.sendMethod,
      fx_loss_guess: s.fxLossGuess,
      price_willing: s.priceWilling,
      agency_include: s.agencyInclude,
      comment: s.comment.trim().slice(0, 1000),
      app_version: APP_VERSION,
      lang: s.lang,
    },
  });
  await db.meta.put({ key: 'surveyDone', value: Date.now() });
  await track('survey_sent');
  void flushPending();
}

let flushing = false;
/** Envía lo pendiente. Lo que falla se queda para el próximo intento. */
export async function flushPending(): Promise<void> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const sb = await getSupabase();
  if (!sb) return;
  flushing = true;
  try {
    const installId = await getInstallId();
    const items = await db.pending.orderBy('createdAt').toArray();
    for (const it of items) {
      const table = it.kind === 'feedback' ? 'feedback' : 'survey_responses';
      const { error } = await sb.from(table).insert({ ...it.payload, install_id: installId, client_created_at: new Date(it.createdAt).toISOString() });
      if (error) {
        console.warn('[pending]', error);
        // Error de datos (no de red): no tiene sentido reintentar para siempre.
        if (error.code && /^2|^4/.test(error.code)) await db.pending.delete(it.id);
        continue;
      }
      await db.pending.delete(it.id);
    }
  } finally {
    flushing = false;
  }
}

export async function pendingCount(): Promise<number> {
  return db.pending.count();
}
