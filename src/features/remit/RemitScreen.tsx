import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Info, Landmark, Lightbulb, Plus, Scale, Trash2 } from 'lucide-react';
import { compareQuotes, dayKey, pickProviderLink } from '@/domain';
import type { RemitProviderRow } from '@/data/db';
import { fetchFx, type FxQuote } from '@/data/fx';
import { useAppConfig, useRemitProviders, useRemitQuotes } from '@/data/hooks';
import { clearQuotes, deleteQuote } from '@/data/repos/remit';
import { cn } from '@/shared/lib/cn';
import { formatDateISO, formatMoney, formatPen } from '@/shared/lib/format';
import { tap } from '@/shared/lib/haptics';
import { useOnline } from '@/shared/lib/useOnline';
import { Badge, Button, Card, EmptyState, ListGroup, SectionTitle, Select } from '@/shared/ui';
import { OfflinePill } from '@/shared/ui/OfflinePill';
import { QuoteSheet } from './QuoteSheet';

/**
 * Enviar plata a Perú: lista neutral de proveedores (orden alfabético, datos de su web oficial)
 * y un comparador con las cotizaciones que el usuario copia de cada app.
 * Informa; no recomienda a ningún proveedor.
 */
export function RemitScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const online = useOnline();
  const providers = useRemitProviders();
  const quotes = useRemitQuotes();
  const [fx, setFx] = useState<FxQuote | null>(null);
  const [fxDone, setFxDone] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const config = useAppConfig();
  // País de origen (a dónde manda la plata). Por ahora solo hay datos verificados de Perú.
  const countries = useMemo(() => [...new Set((providers ?? []).flatMap((p) => p.countries))].sort(), [providers]);
  const [country, setCountry] = useState('PE');
  const countryName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([lang], { type: 'region' });
      return (c: string) => dn.of(c) ?? c;
    } catch {
      return (c: string) => c;
    }
  }, [lang]);
  const inCountry = (providers ?? []).filter((p) => p.countries.includes(country));
  const remitters = inCountry.filter((p) => p.type === 'remittance');
  const exchanges = inCountry.filter((p) => p.type === 'exchange');

  useEffect(() => {
    let alive = true;
    setFxDone(false);
    void fetchFx(dayKey(Date.now())).then((q) => {
      if (!alive) return;
      setFx(q);
      setFxDone(true);
    });
    return () => {
      alive = false;
    };
  }, [online]);

  const byId = useMemo(() => new Map((providers ?? []).map((p) => [p.id, p])), [providers]);
  const comparison = useMemo(() => compareQuotes(quotes ?? [], fx?.value ?? null), [quotes, fx?.value]);
  const anyReferral = inCountry.some((p) => pickProviderLink(p, config.referralsEnabled).isReferral);
  const providerName = (id: string) => byId.get(id)?.name ?? t('remit.otherProvider');

  return (
    <div className="pb-8">
      <header className="mb-4 flex items-center gap-1 pt-1">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => navigate('/season')}
          className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-ink-2 active:bg-surface-2"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-ink">{t('remit.title')}</h1>
      </header>

      <OfflinePill />

      <p className="px-1 text-[15px] leading-relaxed text-ink-2">{t('remit.intro')}</p>

      <Select className="mt-4" label={t('remit.country')} value={country} onChange={(e) => setCountry(e.target.value)}>
        {(countries.length ? countries : ['PE']).map((c) => (
          <option key={c} value={c}>
            {countryName(c)}
          </option>
        ))}
      </Select>
      <p className="mt-1.5 px-1 text-[12px] leading-snug text-ink-3">{t('remit.countryNote')}</p>

      {/* Consejos generales */}
      <Card className="mt-4 p-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Lightbulb className="h-5 w-5 text-warn" /> {t('remit.tipsTitle')}
        </div>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-snug text-ink-2">
          {(['tip1', 'tip2', 'tip3', 'tip4'] as const).map((k) => (
            <li key={k}>{t(`remit.${k}`)}</li>
          ))}
        </ul>
      </Card>

      {country === 'PE' && (
        <>
          {/* Tipo de cambio de referencia */}
          <Card className="mt-4 flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Landmark className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink-3">{fx?.provider === 'sunat' ? t('remit.refLabelSunat') : t('remit.refLabel')}</span>
              {fx ? (
                <>
                  <span className="tnum block text-[20px] font-semibold text-ink">S/ {fx.value.toFixed(4)}</span>
                  <span className="block text-[12px] text-ink-3">{t('remit.refDate', { date: formatDateISO(fx.date, lang) })}</span>
                </>
              ) : (
                <span className="block text-[14px] text-ink-2">
                  {!online ? t('remit.refOffline') : fxDone ? t('remit.refUnavailable') : t('remit.refLoading')}
                </span>
              )}
            </span>
          </Card>

          {/* Comparador */}
          <SectionTitle
            action={
              (quotes?.length ?? 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    tap();
                    void clearQuotes();
                  }}
                  className="flex h-10 items-center rounded-full px-3 text-[14px] font-semibold text-ink-3 active:bg-surface-2"
                >
                  {t('remit.clearAll')}
                </button>
              ) : undefined
            }
          >
            {t('remit.compare')}
          </SectionTitle>
          {quotes && quotes.length === 0 ? (
            <EmptyState
              icon={<Scale />}
              title={t('remit.emptyTitle')}
              body={t('remit.emptyBody')}
              action={
                <Button block icon={<Plus className="h-5 w-5" />} onClick={() => setQuoteOpen(true)}>
                  {t('remit.addQuote')}
                </Button>
              }
            />
          ) : (
            <>
              {comparison.mixedWithoutReference && <p className="mb-2 rounded-2xl bg-warn/10 px-4 py-3 text-[13px] text-ink">{t('remit.mixedNoRef')}</p>}
              <ListGroup>
                {comparison.results.map((r) => {
                  const first = r.rank === 1;
                  return (
                    <div key={r.id} className="flex items-start gap-3 px-4 py-3.5">
                      <span
                        className={cn(
                          'tnum mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold',
                          first ? 'bg-positive/15 text-positive' : 'bg-surface-2 text-ink-2',
                        )}
                      >
                        {r.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[16px] font-semibold text-ink">{providerName(r.providerId)}</span>
                          {first && comparison.results.length > 1 && <Badge tone="positive">{t('remit.mostReceived')}</Badge>}
                        </div>
                        <p className="tnum mt-0.5 text-[14px] text-ink-2">
                          {t('remit.paysReceives', {
                            paid: formatMoney(r.totalPaidCents, lang),
                            received: r.receiveCurrency === 'PEN' ? formatPen(r.receivedCents, lang) : formatMoney(r.receivedCents, lang),
                          })}
                        </p>
                        {r.effectiveRate !== null && (
                          <p className="tnum text-[13px] text-ink-3">
                            {t('remit.effective', {
                              rate: r.effectiveRate.toFixed(4),
                            })}
                          </p>
                        )}
                        {r.lossPenCents !== null && r.lossPct !== null && (
                          <p className={cn('tnum text-[13px]', r.lossPenCents > 0 ? 'text-ink-2' : 'text-positive')}>
                            {r.lossPenCents > 0
                              ? t('remit.loss', {
                                  amount: formatPen(r.lossPenCents, lang),
                                  pct: (r.lossPct * 100).toFixed(1),
                                })
                              : t('remit.noLoss')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={t('common.delete')}
                        onClick={() => {
                          tap();
                          void deleteQuote(r.id);
                        }}
                        className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 active:bg-surface-2"
                      >
                        <Trash2 className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  );
                })}
              </ListGroup>
              <div className="mt-3">
                <Button block variant="secondary" icon={<Plus className="h-5 w-5" />} onClick={() => setQuoteOpen(true)}>
                  {t('remit.addQuote')}
                </Button>
              </div>
              <p className="mt-3 px-1 text-[12px] leading-snug text-ink-3">{t('remit.compareNote')}</p>
            </>
          )}
        </>
      )}

      {/* Proveedores */}
      <SectionTitle>{t('remit.providers')}</SectionTitle>
      <div className="mb-3 flex gap-2.5 rounded-2xl bg-surface-2 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
        <p className="text-[13px] leading-snug text-ink-2">
          {t('remit.neutral')}
          {anyReferral && <> {t('remit.referralDisclosure')}</>}
        </p>
      </div>
      <div className="grid gap-3">
        {remitters.map((p) => (
          <ProviderCard key={p.id} p={p} referralsEnabled={config.referralsEnabled} />
        ))}
      </div>
      {exchanges.length > 0 && (
        <>
          <SectionTitle>{t('remit.exchanges', { country: countryName(country) })}</SectionTitle>
          <p className="mb-3 px-1 text-[13px] leading-snug text-ink-2">{t('remit.exchangesIntro')}</p>
          <div className="grid gap-3">
            {exchanges.map((p) => (
              <ProviderCard key={p.id} p={p} referralsEnabled={config.referralsEnabled} />
            ))}
          </div>
          <p className="mt-3 px-1 text-[12px] leading-snug text-ink-3">{t('remit.sbsTip')}</p>
        </>
      )}
      <p className="mt-5 px-1 text-[12px] leading-snug text-ink-3">{t('remit.disclaimer')}</p>

      <QuoteSheet open={quoteOpen} onClose={() => setQuoteOpen(false)} providers={remitters} />
    </div>
  );
}

function ProviderCard({ p, referralsEnabled }: { p: RemitProviderRow; referralsEnabled: boolean }) {
  const { t, i18n } = useTranslation();
  const link = pickProviderLink(p, referralsEnabled);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-ink">{p.name}</h3>
        {link.isReferral && <Badge tone="warn">{t('remit.referralBadge')}</Badge>}
      </div>
      {p.type === 'remittance' ? (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {p.methods.map((m) => (
              <Badge key={m} tone="accent">
                {m === 'wallet' && p.wallets.length > 0
                  ? t('remit.method.walletNamed', {
                      names: p.wallets.join(', '),
                    })
                  : t(`remit.method.${m}`)}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-[14px] text-ink-2">
            {t('remit.arrivesIn', {
              list: p.receiveCurrencies.map((c) => t(`remit.currency.${c}`)).join(` ${t('remit.or')} `),
            })}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[14px] text-ink-2">{t('remit.exchangeBody')}</p>
      )}
      {p.notes && <p className="mt-1.5 text-[13px] leading-snug text-ink-3">{p.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <a
          href={link.href}
          target="_blank"
          rel={link.isReferral ? 'noreferrer sponsored' : 'noreferrer'}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-ink active:scale-95"
        >
          {t('remit.goTo', { name: p.name })} <ExternalLink className="h-4 w-4" />
        </a>
        {p.sourceUrls.map((u, i) => (
          <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 py-2 text-[13px] font-semibold text-accent">
            {p.sourceUrls.length > 1 ? `${t('common.source')} ${i + 1}` : t('common.source')} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-3">
        {t('common.verifiedOn', {
          date: formatDateISO(p.verifiedAt, i18n.language),
        })}
      </p>
    </Card>
  );
}
