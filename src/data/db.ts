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
  /** Cuándo aceptó la política de privacidad y qué versión */
  consentAt: number | null;
  consentVersion: string | null;
  /** true = no enviar métricas anónimas */
  analyticsOptOut: boolean;
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
  /** Overtime diario del estado (ej. 8 en California). null = sin overtime diario. */
  overtimeDailyHours: number | null;
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
  /** Soles por dólar usado en este movimiento (venta: BCRP interbancario o, de respaldo, SUNAT) */
  fxRate: number | null;
  /** Fecha del tipo de cambio (yyyy-mm-dd): puede ser el día hábil anterior */
  fxDate: string | null;
  fxSource: 'bcrp' | 'sunat' | 'manual' | null;
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

export type RemitProviderType = 'remittance' | 'exchange';

/** Datos de un proveedor para un país distinto de Perú (verificados en su web para envíos desde EE. UU.) */
export interface RemitCorridor {
  url: string;
  methods: RemitMethod[];
  receiveCurrencies: string[];
  wallets: string[];
  sourceUrls: string[];
  verifiedAt: string;
}

export interface RemitProviderRow {
  id: string;
  /** Por país (ISO alfa-2). Perú vive en los campos principales. */
  corridors: Record<string, RemitCorridor>;
  name: string;
  type: RemitProviderType;
  /** Países de destino verificados (ISO alfa-2) */
  countries: string[];
  referralEnabled: boolean;
  notes: string | null;
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

/** Interruptores públicos (tabla app_config de Supabase) */
export interface AppConfigRow {
  key: string;
  value: unknown;
}

export type EventName =
  | 'signup'
  | 'account_created'
  | 'app_open'
  | 'shift_logged'
  | 'paystub_reviewed'
  | 'discrepancy_detected'
  | 'fica_alert_shown'
  | 'feedback_sent'
  | 'survey_sent'
  | 'export_made'
  | 'remit_quote_added'
  | 'install_completed'
  | 'push_enabled';

/** Evento de métricas en cola (sin datos personales) */
export interface EventRow {
  seq?: number;
  name: EventName;
  props: Record<string, string | number | boolean>;
  clientAt: number;
}

/** Envíos a Supabase que esperan señal: feedback y encuesta */
export interface PendingSubmissionRow {
  id: string;
  kind: 'feedback' | 'survey';
  payload: Record<string, unknown>;
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
  appConfig!: EntityTable<AppConfigRow, 'key'>;
  events!: EntityTable<EventRow, 'seq'>;
  pending!: EntityTable<PendingSubmissionRow, 'id'>;
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
    // v5 (pre-temporada): configuración pública, cola de métricas y envíos pendientes.
    this.version(5)
      .stores({
        appConfig: 'key',
        events: '++seq, clientAt',
        pending: 'id, kind, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('profile')
          .toCollection()
          .modify((p: Partial<ProfileRow>) => {
            p.consentAt ??= null;
            p.consentVersion ??= null;
            p.analyticsOptOut ??= false;
          });
        await tx
          .table('remitProviders')
          .toCollection()
          .modify((r: Partial<RemitProviderRow>) => {
            r.type ??= 'remittance';
            r.countries ??= ['PE'];
            r.referralEnabled ??= false;
            r.notes ??= null;
          });
      });
    // v6: overtime diario por estado.
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('employers')
          .toCollection()
          .modify((e: Partial<EmployerRow>) => {
            e.overtimeDailyHours ??= null;
          });
      });
    // v7: corredores por país en los proveedores.
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('remitProviders')
          .toCollection()
          .modify((r: Partial<RemitProviderRow>) => {
            r.corridors ??= {};
          });
      });
  }
}

export const db = new SeasonPayDB();
