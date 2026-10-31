/**
 * Moneda del país a donde va el ahorro. El tipo de cambio de cada moneda sale de una fuente oficial
 * (configurada en tax_rules: fx_usd_pen_series para Perú y fx_usd_local para el resto).
 * Aquí solo hay datos de formato y rangos de control para lo que escribe el usuario a mano.
 */

export const HOME_CURRENCIES = ['PEN', 'ARS', 'BOB', 'BRL', 'CLP', 'COP', 'USD'] as const;
export type HomeCurrency = (typeof HOME_CURRENCIES)[number];

/** País (ISO alfa-2) de cada moneda, para buscar su regla y su bandera en la app. */
export const CURRENCY_COUNTRY: Record<HomeCurrency, string> = {
  PEN: 'PE',
  ARS: 'AR',
  BOB: 'BO',
  BRL: 'BR',
  CLP: 'CL',
  COP: 'CO',
  USD: 'EC',
};

/** Símbolo que se muestra antes del monto. ARS, CLP y COP usan "$" en su país: se agrega el código para no confundir con el dólar. */
export const CURRENCY_SYMBOL: Record<HomeCurrency, string> = {
  PEN: 'S/',
  ARS: 'ARS $',
  BOB: 'Bs',
  BRL: 'R$',
  CLP: 'CLP $',
  COP: 'COP $',
  USD: 'US$',
};

/** Decimales al mostrar montos (el peso chileno y el colombiano se usan sin centavos). */
export const CURRENCY_DECIMALS: Record<HomeCurrency, number> = {
  PEN: 2,
  ARS: 2,
  BOB: 2,
  BRL: 2,
  CLP: 0,
  COP: 0,
  USD: 2,
};

/**
 * Rango razonable de "moneda local por 1 dólar" para validar lo que el usuario escribe a mano.
 * Es un control contra errores de tipeo (ej. poner 99,3 en vez de 993), no un dato oficial.
 */
export const MANUAL_RATE_RANGE: Record<HomeCurrency, [number, number]> = {
  PEN: [1, 10],
  ARS: [10, 100_000],
  BOB: [1, 100],
  BRL: [1, 50],
  CLP: [100, 10_000],
  COP: [100, 100_000],
  USD: [1, 1],
};

export function isHomeCurrency(x: unknown): x is HomeCurrency {
  return typeof x === 'string' && (HOME_CURRENCIES as readonly string[]).includes(x);
}

/** Ecuador usa el dólar: no hay conversión. */
export const needsConversion = (c: HomeCurrency) => c !== 'USD';

export function manualRateOk(c: HomeCurrency, rate: number): boolean {
  const [min, max] = MANUAL_RATE_RANGE[c];
  return Number.isFinite(rate) && rate >= min && rate <= max;
}
