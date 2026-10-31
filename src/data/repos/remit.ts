import { db, type RemitProviderRow, type RemitQuoteRow } from '../db';
import seed from '../seed/remitProviders.json';
import { sortProvidersNeutral } from '@/domain/referrals';
import { track } from '../telemetry';

interface SeedProvider {
  id: string;
  name: string;
  url: string;
  type?: RemitProviderRow['type'];
  countries?: string[];
  referral_enabled?: boolean;
  notes?: string | null;
  corridors?: Record<string, { url: string; methods: RemitProviderRow['methods']; receive_currencies: string[]; wallets?: string[]; source_urls: string[]; verified_at: string }>;
  methods: RemitProviderRow['methods'];
  receive_currencies: RemitProviderRow['receiveCurrencies'];
  wallets: string[];
  referral_url: string | null;
  source_urls: string[];
  verified_at: string;
  active?: boolean;
}

export const providerFromRemote = (r: SeedProvider): RemitProviderRow => ({
  id: r.id,
  name: r.name,
  url: r.url,
  type: r.type === 'exchange' ? 'exchange' : 'remittance',
  countries: r.countries && r.countries.length > 0 ? r.countries : ['PE'],
  referralEnabled: r.referral_enabled === true,
  notes: r.notes ?? null,
  corridors: Object.fromEntries(
    Object.entries(r.corridors ?? {}).map(([k, c]) => [
      k,
      { url: c.url, methods: c.methods, receiveCurrencies: c.receive_currencies ?? [], wallets: c.wallets ?? [], sourceUrls: c.source_urls ?? [c.url], verifiedAt: String(c.verified_at) },
    ]),
  ),
  methods: r.methods,
  receiveCurrencies: r.receive_currencies,
  wallets: r.wallets ?? [],
  referralUrl: r.referral_url ?? null,
  sourceUrls: r.source_urls,
  verifiedAt: String(r.verified_at),
  active: r.active !== false,
});

/** Carga los proveedores incluidos en la app sin pisar una versión más reciente bajada de Supabase. */
export async function ensureProvidersSeeded(): Promise<void> {
  const rows = (seed as { providers: SeedProvider[] }).providers.map(providerFromRemote);
  await db.transaction('rw', db.remitProviders, async () => {
    for (const p of rows) {
      const existing = await db.remitProviders.get(p.id);
      if (existing && existing.verifiedAt > p.verifiedAt) continue;
      await db.remitProviders.put(p);
    }
  });
}

/** Orden alfabético: neutral, no depende de quién tenga link de referido. */
export async function listProviders(): Promise<RemitProviderRow[]> {
  const rows = await db.remitProviders.toArray();
  return sortProvidersNeutral(rows.filter((p) => p.active));
}

export async function listQuotes(): Promise<RemitQuoteRow[]> {
  return db.remitQuotes.orderBy('createdAt').toArray();
}

export async function addQuote(q: Omit<RemitQuoteRow, 'id' | 'createdAt'>): Promise<void> {
  await db.remitQuotes.add({ ...q, id: crypto.randomUUID(), createdAt: Date.now() });
  await track('remit_quote_added', { provider: q.providerId, currency: q.receiveCurrency });
}

export async function deleteQuote(id: string): Promise<void> {
  await db.remitQuotes.delete(id);
}

export async function clearQuotes(): Promise<void> {
  await db.remitQuotes.clear();
}
