import { describe, expect, it } from 'vitest';
import { centsToInput, parseMoneyInput } from './money';

describe('parseMoneyInput', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12,50', 1250],
    ['$1,234.56', 123456],
    ['', 0],
    ['0.07', 7],
  ])('%s → %i', (input, cents) => expect(parseMoneyInput(input)).toBe(cents));

  it('rechaza texto inválido', () => {
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('1.234')).toBeNull();
  });
});

describe('centsToInput', () => {
  it('formatea a 2 decimales', () => expect(centsToInput(1550)).toBe('15.50'));
  it('0 queda vacío', () => expect(centsToInput(0)).toBe(''));
});
