import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Lock, RefreshCw, Star } from 'lucide-react';
import { useAuth } from '@/data/sync/auth';
import { cn } from '@/shared/lib/cn';
import { useOnline } from '@/shared/lib/useOnline';
import { Badge, Card, EmptyState, SectionTitle, SegmentedControl, Stat } from '@/shared/ui';
import { checkIsAdmin, countBy, loadFeedback, loadMetrics, loadSurveys, type FeedbackItem, type Metrics, type SurveyItem } from './adminApi';

type Tab = 'feedback' | 'survey' | 'metrics';

/** Vista simple para el dueño del piloto: feedback, encuestas y métricas (solo con internet). */
export function AdminScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const online = useOnline();
  const { session, ready } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('feedback');
  const [feedback, setFeedback] = useState<FeedbackItem[] | null>(null);
  const [surveys, setSurveys] = useState<SurveyItem[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!session) return setIsAdmin(false);
    void checkIsAdmin().then(setIsAdmin);
  }, [ready, session]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, s, m] = await Promise.all([loadFeedback(), loadSurveys(), loadMetrics()]);
      setFeedback(f);
      setSurveys(s);
      setMetrics(m);
    } catch (e) {
      setError(String((e as { message?: string }).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && online) void load();
  }, [isAdmin, online]);

  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="pb-8">
      <header className="mb-4 flex items-center gap-1 pt-1">
        <button type="button" aria-label={t('common.back')} onClick={() => navigate('/settings')} className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-ink-2 active:bg-surface-2">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="flex-1 text-[26px] font-semibold tracking-[-0.025em] text-ink">{t('admin.title')}</h1>
        {isAdmin && (
          <button type="button" aria-label={t('admin.reload')} onClick={() => void load()} className="grid h-11 w-11 place-items-center rounded-full text-accent active:bg-accent-soft">
            <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </button>
        )}
      </header>

      {isAdmin === false && <EmptyState icon={<Lock />} title={t('admin.forbiddenTitle')} body={t('admin.forbiddenBody')} />}
      {isAdmin && !online && <EmptyState icon={<Lock />} title={t('admin.offline')} />}
      {error && <p className="mb-3 rounded-2xl bg-danger-soft px-4 py-3 text-[14px] text-danger">{error}</p>}

      {isAdmin && online && (
        <>
          <SegmentedControl
            ariaLabel={t('admin.title')}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { value: 'feedback', label: t('admin.tabFeedback', { n: feedback?.length ?? 0 }) },
              { value: 'survey', label: t('admin.tabSurvey', { n: surveys?.length ?? 0 }) },
              { value: 'metrics', label: t('admin.tabMetrics') },
            ]}
          />

          {tab === 'feedback' && (
            <div className="mt-4 grid gap-3">
              {feedback?.length === 0 && <EmptyState icon={<Star />} title={t('admin.empty')} />}
              {feedback?.map((f) => (
                <Card key={f.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex gap-0.5" aria-label={t('feedback.stars', { count: f.rating })}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={cn('h-4 w-4', n <= f.rating ? 'fill-warn text-warn' : 'text-line')} />
                      ))}
                    </span>
                    <span className="text-[12px] text-ink-3">{when(f.created_at)}</span>
                  </div>
                  {f.what_failed && (
                    <p className="mt-2 text-[14px] text-ink">
                      <strong className="font-semibold">{t('admin.failed')}</strong> {f.what_failed}
                    </p>
                  )}
                  {f.wish && (
                    <p className="mt-1 text-[14px] text-ink">
                      <strong className="font-semibold">{t('admin.wish')}</strong> {f.wish}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge>{f.screen}</Badge>
                    <Badge>{f.os}</Badge>
                    <Badge>v{f.app_version}</Badge>
                    <Badge>{f.lang}</Badge>
                  </div>
                  {f.screenshot && (
                    <a href={f.screenshot} target="_blank" rel="noreferrer">
                      <img src={f.screenshot} alt={t('feedback.preview')} className="mt-3 max-h-56 rounded-xl ring-1 ring-line" />
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}

          {tab === 'survey' && surveys && (
            <div className="mt-2">
              {(['send_method', 'fx_loss_guess', 'price_willing', 'agency_include'] as const).map((k) => (
                <div key={k}>
                  <SectionTitle>{t(`survey.q.${k}`)}</SectionTitle>
                  <Card className="p-4">
                    {countBy(surveys, k).map(([opt, n]) => (
                      <div key={opt} className="flex items-center gap-3 py-1.5">
                        <span className="min-w-0 flex-1 text-[14px] text-ink">{t(`survey.opt.${k}.${opt}`)}</span>
                        <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / surveys.length) * 100}%` }} />
                        </span>
                        <span className="tnum w-8 text-right text-[14px] font-semibold text-ink">{n}</span>
                      </div>
                    ))}
                    {surveys.length === 0 && <p className="text-[14px] text-ink-3">{t('admin.empty')}</p>}
                  </Card>
                </div>
              ))}
              <SectionTitle>{t('survey.q.comment')}</SectionTitle>
              <Card className="p-4">
                {surveys.filter((s) => s.comment).map((s, i) => (
                  <p key={i} className="border-b border-line py-2 text-[14px] text-ink last:border-0">
                    {s.comment}
                  </p>
                ))}
              </Card>
            </div>
          )}

          {tab === 'metrics' && metrics && (
            <div className="mt-2">
              <SectionTitle>{t('admin.users')}</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={t('admin.registered')} value={String(metrics.registered?.installs_registered ?? 0)} />
                <Stat label={t('admin.withAccount')} value={String(metrics.registered?.installs_with_account ?? 0)} />
                <Stat label={t('admin.installedPwa')} value={String(metrics.registered?.installs_pwa ?? 0)} />
                <Stat label={t('admin.payErrors')} value={metrics.paymentErrors?.pct_with_discrepancy == null ? '—' : `${metrics.paymentErrors.pct_with_discrepancy}%`} />
              </div>
              <p className="mt-2 px-1 text-[12px] text-ink-3">
                {t('admin.payErrorsNote', { reviewed: metrics.paymentErrors?.installs_reviewed ?? 0, flagged: metrics.paymentErrors?.installs_with_discrepancy ?? 0 })}
              </p>

              <SectionTitle>{t('admin.retention')}</SectionTitle>
              <Card className="overflow-x-auto p-0">
                <table className="tnum w-full text-left text-[13px]">
                  <thead className="text-ink-3">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t('admin.cohort')}</th>
                      <th className="px-2 py-2 font-medium">{t('admin.n')}</th>
                      <th className="px-2 py-2 font-medium">2 sem</th>
                      <th className="px-4 py-2 font-medium">4 sem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.retention.map((r) => (
                      <tr key={String(r.cohort_week)} className="border-t border-line text-ink">
                        <td className="px-4 py-2">{String(r.cohort_week)}</td>
                        <td className="px-2 py-2">{String(r.installs)}</td>
                        <td className="px-2 py-2">{r.pct_2w == null ? '—' : `${r.pct_2w}%`}</td>
                        <td className="px-4 py-2">{r.pct_4w == null ? '—' : `${r.pct_4w}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {metrics.retention.length === 0 && <p className="px-4 pb-3 text-[13px] text-ink-3">{t('admin.empty')}</p>}
              </Card>

              <SectionTitle>{t('admin.weekly')}</SectionTitle>
              <Card className="p-4">
                {metrics.weekly.map((w) => (
                  <div key={w.week} className="tnum flex justify-between py-1 text-[14px] text-ink">
                    <span>{w.week}</span>
                    <span className="font-semibold">{w.active_installs}</span>
                  </div>
                ))}
                {metrics.weekly.length === 0 && <p className="text-[13px] text-ink-3">{t('admin.empty')}</p>}
              </Card>

              <SectionTitle>{t('admin.usage')}</SectionTitle>
              <Card className="p-4">
                {metrics.usage.map((u) => (
                  <div key={u.name} className="tnum flex justify-between gap-3 py-1 text-[14px] text-ink">
                    <span className="min-w-0 flex-1 truncate">{t(`admin.events.${u.name}`, { defaultValue: u.name })}</span>
                    <span className="text-ink-3">{t('admin.usageRow', { installs: u.installs, events: u.events })}</span>
                  </div>
                ))}
                {metrics.usage.length === 0 && <p className="text-[13px] text-ink-3">{t('admin.empty')}</p>}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
