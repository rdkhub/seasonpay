import type { EmployerRow, PayFrequency } from '@/data/db';
import type { EmployerDraft } from '@/data/repos/employers';
import { centsToInput, parseMoneyInput } from '@/shared/lib/money';

/** Estado, conversión y validación del formulario de empleador (sin React). */

export interface EmployerFormValue {
  name: string;
  rate: string;
  payFrequency: PayFrequency;
  workweekStartDay: number;
  overtimeEnabled: boolean;
  threshold: string;
  multiplier: string;
  /** Overtime diario en horas; vacío = sin overtime diario */
  daily: string;
}

export type EmployerFormErrors = Partial<Record<'name' | 'rate' | 'threshold' | 'multiplier' | 'daily', string>>;

export const PAY_FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

export function emptyEmployerForm(ot?: { enabled: boolean; thresholdHours: number; multiplier: number; dailyHours?: number | null }): EmployerFormValue {
  return {
    name: '',
    rate: '',
    payFrequency: 'biweekly',
    workweekStartDay: 1,
    overtimeEnabled: ot?.enabled ?? false,
    threshold: ot ? String(ot.thresholdHours) : '',
    multiplier: ot ? String(ot.multiplier) : '',
    daily: ot?.dailyHours ? String(ot.dailyHours) : '',
  };
}

export function employerToForm(e: EmployerRow): EmployerFormValue {
  return {
    name: e.name,
    rate: centsToInput(e.hourlyRateCents, false),
    payFrequency: e.payFrequency,
    workweekStartDay: e.workweekStartDay,
    overtimeEnabled: e.overtimeEnabled,
    threshold: String(e.overtimeThresholdHours),
    multiplier: String(e.overtimeMultiplier),
    daily: e.overtimeDailyHours ? String(e.overtimeDailyHours) : '',
  };
}

/** Valida y convierte. Devuelve errores con claves de i18n o el borrador listo para guardar. */
export function validateEmployerForm(v: EmployerFormValue, withOvertime: boolean): { errors: EmployerFormErrors; draft: EmployerDraft | null } {
  const errors: EmployerFormErrors = {};
  if (!v.name.trim()) errors.name = 'employer.errors.name';
  const rate = parseMoneyInput(v.rate);
  if (rate === null || rate <= 0) errors.rate = 'employer.errors.rate';

  let threshold: number | undefined;
  let multiplier: number | undefined;
  let daily: number | null | undefined;
  if (withOvertime && v.overtimeEnabled) {
    const d = v.daily.trim().replace(',', '.');
    daily = d === '' ? null : Number(d);
    if (daily !== null && (!Number.isFinite(daily) || daily <= 0 || daily > 24)) errors.daily = 'shiftForm.errors.times';
    threshold = Number(v.threshold.replace(',', '.'));
    multiplier = Number(v.multiplier.replace(',', '.'));
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 168) errors.threshold = 'shiftForm.errors.times';
    if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 5) errors.multiplier = 'shiftForm.errors.money';
  }
  if (Object.keys(errors).length > 0) return { errors, draft: null };
  return {
    errors,
    draft: {
      name: v.name.trim(),
      hourlyRateCents: rate!,
      payFrequency: v.payFrequency,
      ...(withOvertime
        ? {
            workweekStartDay: v.workweekStartDay,
            overtimeEnabled: v.overtimeEnabled,
            ...(v.overtimeEnabled ? { overtimeThresholdHours: threshold, overtimeMultiplier: multiplier, overtimeDailyHours: daily } : {}),
          }
        : {}),
    },
  };
}
