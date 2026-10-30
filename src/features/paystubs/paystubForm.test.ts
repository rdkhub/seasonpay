import { describe, expect, it } from 'vitest';
import { minutesToHoursInput, parseHoursInput, suggestedPeriod } from './paystubForm';
import type { EmployerRow } from '@/data/db';

const emp = (payFrequency: EmployerRow['payFrequency']): EmployerRow => ({
  id: 'e',
  name: 'X',
  hourlyRateCents: 1500,
  payFrequency,
  workweekStartDay: 1,
  overtimeEnabled: true,
  overtimeThresholdHours: 40,
  overtimeMultiplier: 1.5,
  overtimeDailyHours: null,
  overtimeRuleKey: null,
  archived: false,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
});

describe('parseHoursInput', () => {
  it.each([
    ['40', 2400],
    ['5.5', 330],
    ['7,25', 435],
    ['', 0],
  ])('%s → %i min', (s, m) => expect(parseHoursInput(s)).toBe(m));
  it('rechaza texto', () => expect(parseHoursInput('abc')).toBeNull());
  it('ida y vuelta', () => expect(minutesToHoursInput(330)).toBe('5.5'));
});

describe('suggestedPeriod', () => {
  const sat = new Date(2026, 9, 17, 12).getTime(); // sábado 17 oct 2026
  it('quincenal (cada 2 semanas): las dos semanas laborales completas anteriores', () => {
    expect(suggestedPeriod(emp('biweekly'), sat)).toEqual({ start: '2026-09-28', end: '2026-10-11' });
  });
  it('semanal', () => expect(suggestedPeriod(emp('weekly'), sat)).toEqual({ start: '2026-10-05', end: '2026-10-11' }));
  it('dos veces al mes después del 15', () => expect(suggestedPeriod(emp('semimonthly'), sat)).toEqual({ start: '2026-10-01', end: '2026-10-15' }));
  it('mensual', () => expect(suggestedPeriod(emp('monthly'), sat)).toEqual({ start: '2026-09-01', end: '2026-09-30' }));
});
