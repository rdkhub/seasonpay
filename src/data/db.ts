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

export type SyncTable = 'profiles' | 'employers' | 'shifts' | 'paystubs';

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
  taxRules!: EntityTable<TaxRuleRow, 'id'>;
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
  }
}

export const db = new SeasonPayDB();
