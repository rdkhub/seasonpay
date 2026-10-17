import { db, type TaxRuleRow } from '../db';
import seed from '../seed/rules.json';

interface SeedRule {
  key: string;
  jurisdiction: string;
  year: number;
  value: Record<string, unknown>;
  source_url: string;
  verified_at: string;
  reviewed_by: string | null;
}

export const ruleId = (jurisdiction: string, key: string, year: number) => `${jurisdiction}:${key}:${year}`;

/**
 * Carga las reglas incluidas en la app. Si en el celular ya hay una versión
 * verificada más reciente (por ejemplo, bajada de Supabase), no la pisa.
 */
export async function ensureRulesSeeded(): Promise<void> {
  const rules = (seed as { rules: SeedRule[] }).rules;
  await db.transaction('rw', db.taxRules, async () => {
    for (const r of rules) {
      const id = ruleId(r.jurisdiction, r.key, r.year);
      const existing = await db.taxRules.get(id);
      if (existing && existing.verifiedAt > r.verified_at) continue;
      await db.taxRules.put({
        id,
        key: r.key,
        jurisdiction: r.jurisdiction,
        year: r.year,
        value: r.value,
        sourceUrl: r.source_url,
        verifiedAt: r.verified_at,
        reviewedBy: r.reviewed_by,
      });
    }
  });
}

/**
 * Regla vigente: la del año pedido o, si no existe, la del año anterior más cercano.
 * Primero busca la del estado (ej. "MT") y si no hay, la federal.
 */
export async function getRule(key: string, opts: { year?: number; state?: string | null } = {}): Promise<TaxRuleRow | undefined> {
  const year = opts.year ?? new Date().getFullYear();
  const pick = async (jurisdiction: string) => {
    const rows = await db.taxRules.where('[key+jurisdiction]').equals([key, jurisdiction]).toArray();
    return rows.filter((r) => r.year <= year).sort((a, b) => b.year - a.year)[0] ?? rows.sort((a, b) => a.year - b.year)[0];
  };
  if (opts.state) {
    const s = await pick(opts.state);
    if (s) return s;
  }
  return pick('federal');
}

export async function listRules(): Promise<TaxRuleRow[]> {
  const rows = await db.taxRules.toArray();
  return rows.sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || a.key.localeCompare(b.key));
}

export interface OvertimeDefaults {
  enabled: boolean;
  thresholdHours: number;
  multiplier: number;
  ruleKey: string | null;
}

/** Valores iniciales de overtime para un empleador nuevo, sacados de tax_rules. */
export async function overtimeDefaults(state: string | null): Promise<OvertimeDefaults> {
  const rule = await getRule('overtime_weekly', { state });
  const v = rule?.value as { threshold_hours?: number; multiplier?: number } | undefined;
  if (!rule || typeof v?.threshold_hours !== 'number' || typeof v?.multiplier !== 'number') {
    // Sin regla cargada: el overtime queda apagado en vez de inventar valores.
    return { enabled: false, thresholdHours: 0, multiplier: 1, ruleKey: null };
  }
  return { enabled: true, thresholdHours: v.threshold_hours, multiplier: v.multiplier, ruleKey: rule.id };
}
