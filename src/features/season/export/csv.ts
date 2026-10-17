/** CSV con BOM UTF-8 para que Excel muestre bien tildes y ñ. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export const centsToDecimal = (c: number) => (c / 100).toFixed(2);
export const minutesToHours = (m: number) => (m / 60).toFixed(2);
