/** Formatos de dinero, horas y fechas según el idioma activo. */

const localeFor = (lang: string) => (lang.startsWith('en') ? 'en-US' : 'es-US');

const moneyCache = new Map<string, Intl.NumberFormat>();
function moneyFmt(lang: string, fractionDigits: number) {
  const k = `${lang}|${fractionDigits}`;
  let f = moneyCache.get(k);
  if (!f) {
    f = new Intl.NumberFormat(localeFor(lang), {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    moneyCache.set(k, f);
  }
  return f;
}

export function formatMoney(cents: number, lang: string, opts: { noCents?: boolean } = {}): string {
  return moneyFmt(lang, opts.noCents ? 0 : 2).format(opts.noCents ? Math.round(cents / 100) : cents / 100);
}

/** Separa "$1,240" y ".50" para mostrar los centavos más chicos. */
export function splitMoney(cents: number, lang: string): { whole: string; fraction: string } {
  const parts = moneyFmt(lang, 2).formatToParts(cents / 100);
  let whole = '';
  let fraction = '';
  let afterDecimal = false;
  for (const p of parts) {
    if (p.type === 'decimal') {
      afterDecimal = true;
      fraction += p.value;
    } else if (afterDecimal && p.type === 'fraction') fraction += p.value;
    else if (afterDecimal && p.type === 'currency') fraction += ` ${p.value}`;
    else whole += p.value;
  }
  return { whole: whole.trim(), fraction };
}

/** 450 → "7 h 30 min" · 480 → "8 h" · 25 → "25 min" */
export function formatHours(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** Versión corta para espacios chicos: 450 → "7:30 h" · 25 → "25 min" */
export function formatHoursShort(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  if (h === 0) return `${m % 60} min`;
  return `${h}:${String(m % 60).padStart(2, '0')} h`;
}

/** 450 → "7.5" para totales compactos */
export function formatHoursDecimal(minutes: number, lang: string): string {
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 2 }).format(minutes / 60);
}

/** Segundos → "02:14:09" */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((x) => String(x).padStart(2, '0')).join(':');
}

export function formatTime(ms: number, lang: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { hour: 'numeric', minute: '2-digit' }).format(ms);
}

export function formatWeekday(ms: number, lang: string, style: 'short' | 'long' = 'short'): string {
  const s = new Intl.DateTimeFormat(localeFor(lang), { weekday: style }).format(ms).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDayMonth(ms: number, lang: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'short' }).format(ms).replace('.', '');
}

export function formatLongDate(ms: number, lang: string): string {
  const s = new Intl.DateTimeFormat(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(ms);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Rango de semana: "19 – 25 oct" o "28 oct – 3 nov" */
export function formatWeekRange(from: number, toExclusive: number, lang: string): string {
  const last = toExclusive - 1;
  const a = new Date(from);
  const b = new Date(last);
  const loc = localeFor(lang);
  if (a.getMonth() === b.getMonth()) {
    const month = new Intl.DateTimeFormat(loc, { month: 'short' }).format(b).replace('.', '');
    return lang.startsWith('en') ? `${month} ${a.getDate()} – ${b.getDate()}` : `${a.getDate()} – ${b.getDate()} ${month}`;
  }
  return `${formatDayMonth(from, lang)} – ${formatDayMonth(last, lang)}`;
}

export function formatDateISO(isoDate: string, lang: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
}

const penCache = new Map<string, Intl.NumberFormat>();
/** Céntimos de sol → "S/ 3,438.00" (Intl muestra "PEN" en algunos idiomas; usamos el símbolo local). */
export function formatPen(cents: number, lang: string): string {
  let f = penCache.get(lang);
  if (!f) {
    f = new Intl.NumberFormat(localeFor(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    penCache.set(lang, f);
  }
  const sign = cents < 0 ? '−' : '';
  return `${sign}S/ ${f.format(Math.abs(cents) / 100)}`;
}
