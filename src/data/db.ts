import Dexie, { type EntityTable } from 'dexie';

/**
 * Base local (IndexedDB). Es la fuente de verdad en el celular.
 * Convenciones:
 * - Tiempos en epoch ms (number). Se pasan a ISO solo al sincronizar.
 * - Dinero en centavos (enteros).
 * - Borrado lógico con deletedAt (lápida) para poder sincronizar borrados.
 * - updatedAt se actualiza en cada escritura: es el reloj de last-write-wins.
 */

export type VisaType = 'j1_student' | 'j1_other' | 'h2b' | 'other';
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type LanguagePref = 'system' | 'es' | 'en';

export interface ProfileRow {
  id: 'me';
  language: LanguagePref;
  visaType: VisaType | null;
  arrivalYear: number | null;
  workState: string | null;
  /** Años calendario anteriores al actual en EE. UU. con visa F, J, M o Q (para FICA) */
  fjPriorYears: number | null;
  /** Meta de ahorro en centavos de dólar */
  savingsGoalCents: number | null;
  /** Ids de los pasos del checklist de fin de temporada que ya hizo */
  checklistDone: string[];
  onboardedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface EmployerRow {
  id: string;
  name: string;
  hourlyRateCents: number;
  payFrequency: PayFrequency;
  /** 0 = domingo … 6 = sábado */
  workweekStartDay: number;
  overtimeEnabled: boolean;
  overtimeThresholdHours: number;
  overtimeMultiplier: number;
  /** Clave de tax_rules de la que salieron los valores de overtime */
  overtimeRuleKey: string | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ShiftRow {
  id: string;
  employerId: string;
  startedAt: number;
  endedAt: number | null;
  breakMinutes: number;
  cashTipsCents: number;
  cardTipsCents: number;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface PaystubRow {
  id: string;
  employerId: string;
  /** yyyy-mm-dd inclusive */
  periodStart: string;
  /** yyyy-mm-dd inclusive */
  periodEnd: string;
  /** yyyy-mm-dd */
  payDate: string;
  regularMinutes: number;
  overtimeMinutes: number;
  grossCents: number;
  /** Propinas que aparecen en la boleta */
  tipsCents: number;
  federalTaxCents: number;
  stateTaxCents: number;
  socialSecurityCents: number;
  medicareCents: number;
  otherDeductionsCents: number;
  netCents: number;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type SavingsKind = 'save' | 'withdraw';

export interface SavingsRow {
  id: string;
  kind: SavingsKind;
  /** yyyy-mm-dd */
  date: string;
  /** Dólares, en centavos */
  amountCents: number;
  /** Soles por dólar usado en este movimiento (BCRP, interbancario venta) */
  fxRate: number | null;
  /** Fecha del tipo de cambio (yyyy-mm-dd): puede ser el día hábil anterior */
  fxDate: string | null;
  fxSource: 'bcrp' | 'manual' | null;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface TaxRuleRow {
  /** `${jurisdiction}:${key}:${year}` */
  id: string;
  key: string;
  jurisdiction: string;
  year: number;
  value: Record<string, unknown>;
  sourceUrl: string;
  verifiedAt: string;
  reviewedBy: string | null;
}

export type RemitMethod = 'bank' | 'cash' | 'wallet';

export interface RemitProviderRow {
  id: string;
  name: string;
  url: string;
  methods: RemitMethod[];
  receiveCurrencies: ('PEN' | 'USD')[];
  wallets: string[];
  /** Link de referido; la app siempre lo marca como tal */
  referralUrl: string | null;
  sourceUrls: string[];
  verifiedAt: string;
  active: boolean;
}

/** Cotización que el usuario copió de la app de un proveedor. Solo vive en este celular. */
export interface RemitQuoteRow {
  id: string;
  providerId: string;
  totalPaidCents: number;
  receivedCents: number;
  receiveCurrency: 'PEN' | 'USD';
  createdAt: number;
}

export type SyncTable = 'profiles' | 'employers' | 'shifts' | 'paystubs' | 'savings';

export interface OutboxRow {
  seq?: number;
  table: SyncTable;
  rowId: string;
  queuedAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class SeasonPayDB extends Dexie {
  profile!: EntityTable<ProfileRow, 'id'>;
  employers!: EntityTable<EmployerRow, 'id'>;
  shifts!: EntityTable<ShiftRow, 'id'>;
  paystubs!: EntityTable<PaystubRow, 'id'>;
  savings!: EntityTable<SavingsRow, 'id'>;
  taxRules!: EntityTable<TaxRuleRow, 'id'>;
  remitProviders!: EntityTable<RemitProviderRow, 'id'>;
  remitQuotes!: EntityTable<RemitQuoteRow, 'id'>;
  outbox!: EntityTable<OutboxRow, 'seq'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor() {
    super('seasonpay');
    this.version(1).stores({
      profile: 'id',
      employers: 'id, updatedAt',
      shifts: 'id, employerId, startedAt, updatedAt',
      taxRules: 'id, key, [key+jurisdiction]',
      outbox: '++seq, table, rowId',
      meta: 'key',
    });
    // v2 (Fase 2): boletas de pago.
    this.version(2).stores({
      paystubs: 'id, employerId, periodEnd, updatedAt',
    });
    // v3 (Fase 3): ahorro USD/PEN.
    this.version(3).stores({
      savings: 'id, date, updatedAt',
    });
    // v4: proveedores para enviar plata a Perú y cotizaciones del comparador (solo locales).
    this.version(4).stores({
      remitProviders: 'id',
      remitQuotes: 'id, createdAt',
    });
  }
}

export const db = new SeasonPayDB();
