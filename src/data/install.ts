import { db } from './db';

/**
 * ID aleatorio de este celular. No está ligado al correo ni a la cuenta:
 * agrupa métricas anónimas y permite borrar el feedback y la encuesta de este celular.
 * "Borrar mi cuenta" lo borra y se crea uno nuevo.
 */
let cached: string | null = null;

export async function getInstallId(): Promise<string> {
  if (cached) return cached;
  const row = await db.meta.get('installId');
  if (typeof row?.value === 'string') return (cached = row.value);
  const id = crypto.randomUUID();
  await db.meta.put({ key: 'installId', value: id });
  return (cached = id);
}

export function resetInstallIdCache(): void {
  cached = null;
}
