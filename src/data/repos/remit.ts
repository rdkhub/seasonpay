import { db, type RemitProviderRow, type RemitQuoteRow } from '../db';
import seed from '../seed/remitProviders.json';

interface SeedProvider {
  id: string;
  name: string;
  url: string;
  methods: RemitProviderRow['methods'];
  receive_currencies: RemitProviderRow['receiveCurrencies'];
  wallets: string[];
  referral_url: string | null;
  source_urls: string[];
  verified_at: string;
  active: boolean;
}

export const providerFromRemote = (r: SeedProvider): RemitProviderRow => ({
  id: r.id,
  name: r.name,
  url: r.url,
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
  return rows.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listQuotes(): Promise<RemitQuoteRow[]> {
  return db.remitQuotes.orderBy('createdAt').toArray();
}

export async function addQuote(q: Omit<RemitQuoteRow, 'id' | 'createdAt'>): Promise<void> {
  await db.remitQuotes.add({ ...q, id: crypto.randomUUID(), createdAt: Date.now() });
}

export async function deleteQuote(id: string): Promise<void> {
  await db.remitQuotes.delete(id);
}

export async function clearQuotes(): Promise<void> {
  await db.remitQuotes.clear();
}
