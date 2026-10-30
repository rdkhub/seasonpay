/**
 * Fechas límite de fin de temporada, calculadas con reglas de tax_rules.
 * Nada escrito a mano: si la regla no está, no hay fecha.
 * Una temporada de invierno cruza dos años tributarios (ej. dic-2026 a mar-2027),
 * así que se devuelven las fechas de cada año en el que hubo trabajo.
 */

export interface DeadlineRuleInput {
  /** Regla federal form_1040nr_due_date (value) */
  federal?: { employee_with_withholding?: { month_after_tax_year?: number; day?: number } } | null;
  /** Regla estatal state_return_due_date (value), ej. {"calendar_year":"04-15"} */
  state?: { calendar_year?: string } | null;
}

export interface Deadline {
  kind: 'federal' | 'state';
  taxYear: number;
  /** yyyy-mm-dd */
  date: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function federalDueDate(taxYear: number, rule: DeadlineRuleInput['federal']): string | null {
  const r = rule?.employee_with_withholding;
  if (!r || typeof r.month_after_tax_year !== 'number' || typeof r.day !== 'number') return null;
  // Año calendario: el mes N después de diciembre del año tributario.
  const m = r.month_after_tax_year;
  if (m < 1 || m > 12 || r.day < 1 || r.day > 31) return null;
  return `${taxYear + 1}-${pad(m)}-${pad(r.day)}`;
}

export function stateDueDate(taxYear: number, rule: DeadlineRuleInput['state']): string | null {
  const md = rule?.calendar_year;
  if (!md || !/^\d{2}-\d{2}$/.test(md)) return null;
  return `${taxYear + 1}-${md}`;
}

/** Años tributarios de la temporada: los años en los que hay turnos. Sin turnos, el año actual. */
export function seasonTaxYears(shiftStarts: number[], now: number): number[] {
  const years = new Set(shiftStarts.map((ms) => new Date(ms).getFullYear()));
  if (years.size === 0) years.add(new Date(now).getFullYear());
  return [...years].sort((a, b) => a - b);
}

export function seasonDeadlines(taxYears: number[], rules: DeadlineRuleInput): Deadline[] {
  const out: Deadline[] = [];
  for (const y of taxYears) {
    const f = federalDueDate(y, rules.federal);
    if (f) out.push({ kind: 'federal', taxYear: y, date: f });
    const s = stateDueDate(y, rules.state);
    if (s) out.push({ kind: 'state', taxYear: y, date: s });
  }
  return out;
}

/** Días entre hoy (yyyy-mm-dd) y la fecha; negativo si ya pasó. */
export function daysUntil(dateISO: string, todayISO: string): number {
  const a = Date.UTC(+todayISO.slice(0, 4), +todayISO.slice(5, 7) - 1, +todayISO.slice(8, 10));
  const b = Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}
