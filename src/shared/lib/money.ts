/**
 * Convierte lo que escribe el usuario a centavos. Acepta "12", "12.5", "12,50", "$1,234.56".
 * Devuelve null si no es un número válido.
 */
export function parseMoneyInput(raw: string): number | null {
  const s = raw.replace(/[$\s]/g, '').trim();
  if (s === '') return 0;
  // Si tiene coma y punto, la coma es separador de miles. Si solo coma, es decimal.
  let normalized = s;
  if (s.includes(',') && s.includes('.')) normalized = s.replace(/,/g, '');
  else if (s.includes(',')) normalized = s.replace(',', '.');
  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Centavos → texto editable ("12.50"; vacío si es 0 y emptyZero). */
export function centsToInput(cents: number, emptyZero = true): string {
  if (emptyZero && cents === 0) return '';
  return (cents / 100).toFixed(2);
}
