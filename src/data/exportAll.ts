import { db } from './db';

/**
 * "Exportar mis datos": todo lo personal que la app guarda en este celular, tal cual.
 * Sirve para el derecho de acceso y para llevarse los datos a otro lado.
 * Las reglas oficiales y los proveedores no se incluyen (son públicos).
 */
export interface MyDataExport {
  app: 'SeasonPay';
  format: 1;
  exportedAt: string;
  profile: unknown;
  employers: unknown[];
  shifts: unknown[];
  paystubs: unknown[];
  savings: unknown[];
  remitQuotes: unknown[];
}

const iso = (v: unknown) => (typeof v === 'number' && v > 1_000_000_000_000 ? new Date(v).toISOString() : v);

/** Pasa los campos *At (epoch ms) a ISO para que el JSON se entienda fuera de la app. */
function readable<T extends object>(row: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, /At$/.test(k) ? iso(v) : v]));
}

export async function buildMyDataExport(now = Date.now()): Promise<MyDataExport> {
  const [profile, employers, shifts, paystubs, savings, remitQuotes] = await Promise.all([
    db.profile.get('me'),
    db.employers.toArray(),
    db.shifts.toArray(),
    db.paystubs.toArray(),
    db.savings.toArray(),
    db.remitQuotes.toArray(),
  ]);
  return {
    app: 'SeasonPay',
    format: 1,
    exportedAt: new Date(now).toISOString(),
    profile: profile ? readable(profile) : null,
    employers: employers.map(readable),
    shifts: shifts.map(readable),
    paystubs: paystubs.map(readable),
    savings: savings.map(readable),
    remitQuotes: remitQuotes.map(readable),
  };
}

export function myDataFile(data: MyDataExport): File {
  const day = data.exportedAt.slice(0, 10);
  return new File([JSON.stringify(data, null, 2)], `seasonpay-mis-datos-${day}.json`, { type: 'application/json' });
}
