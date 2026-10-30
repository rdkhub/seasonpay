/**
 * Qué link mostrar para un proveedor.
 * Regla: el link de referido solo aparece si el interruptor global está prendido,
 * el proveedor lo tiene habilitado y existe un link. En cualquier otro caso, el link normal.
 * Esto no cambia el orden de la lista (que siempre es alfabético).
 */

export interface ReferralCapable {
  url: string;
  referralUrl: string | null;
  referralEnabled: boolean;
}

export interface ProviderLink {
  href: string;
  isReferral: boolean;
}

export function pickProviderLink(p: ReferralCapable, referralsEnabled: boolean): ProviderLink {
  const ref = p.referralUrl?.trim();
  if (referralsEnabled && p.referralEnabled && ref && /^https:\/\//.test(ref)) return { href: ref, isReferral: true };
  return { href: p.url, isReferral: false };
}

/** El orden de los proveedores nunca depende de comisiones ni de referidos: alfabético por nombre. */
export function sortProvidersNeutral<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}
