import { getSupabase } from '@/data/sync/supabaseClient';

/** Lecturas de administración. RLS solo deja leer a quien está en public.admins. */

export interface FeedbackItem {
  id: string;
  rating: number;
  what_failed: string;
  wish: string;
  screenshot: string | null;
  app_version: string;
  os: string;
  screen: string;
  lang: string;
  created_at: string;
}

export interface SurveyItem {
  send_method: string;
  fx_loss_guess: string;
  price_willing: string;
  agency_include: string;
  comment: string;
  created_at: string;
}

export interface Metrics {
  registered: Record<string, number> | null;
  paymentErrors: Record<string, number | null> | null;
  retention: Record<string, string | number | null>[];
  usage: { name: string; events: number; installs: number }[];
  weekly: { week: string; active_installs: number }[];
}

export async function checkIsAdmin(): Promise<boolean> {
  const sb = await getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc('is_admin');
  return !error && data === true;
}

export async function loadFeedback(): Promise<FeedbackItem[]> {
  const sb = (await getSupabase())!;
  const { data, error } = await sb
    .from('feedback')
    .select('id, rating, what_failed, wish, screenshot, app_version, os, screen, lang, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as FeedbackItem[];
}

export async function loadSurveys(): Promise<SurveyItem[]> {
  const sb = (await getSupabase())!;
  const { data, error } = await sb
    .from('survey_responses')
    .select('send_method, fx_loss_guess, price_willing, agency_include, comment, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as SurveyItem[];
}

export async function loadMetrics(): Promise<Metrics> {
  const sb = (await getSupabase())!;
  const [reg, pay, ret, use, wk] = await Promise.all([
    sb.from('metrics_registered').select('*').maybeSingle(),
    sb.from('metrics_payment_errors').select('*').maybeSingle(),
    sb.from('metrics_retention').select('*'),
    sb.from('metrics_feature_usage').select('*'),
    sb.from('metrics_weekly_active').select('*'),
  ]);
  const err = reg.error ?? pay.error ?? ret.error ?? use.error ?? wk.error;
  if (err) throw err;
  return {
    registered: reg.data as Metrics['registered'],
    paymentErrors: pay.data as Metrics['paymentErrors'],
    retention: (ret.data ?? []) as Metrics['retention'],
    usage: (use.data ?? []) as Metrics['usage'],
    weekly: (wk.data ?? []) as Metrics['weekly'],
  };
}

/** Conteo por opción para la encuesta (ej. cuántos eligieron "remittance_app"). */
export function countBy<T>(rows: T[], key: keyof T): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
