import { describe, expect, it } from 'vitest';
import { centsToDecimal, toCsv } from './csv';

describe('toCsv', () => {
  it('escapa comas y comillas, y agrega BOM', () => {
    const csv = toCsv(['a', 'b'], [['Big Sky, MT', 'dijo "hola"'], [1, null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Big Sky, MT","dijo ""hola"""');
    expect(csv).toContain('1,\r\n');
  });
  it('centavos a decimal', () => expect(centsToDecimal(123456)).toBe('1234.56'));
});
