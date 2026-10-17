import { describe, expect, it } from 'vitest';
import { parseBcrpDate, pickRate } from './fx.js';

// Forma real de la respuesta del API del BCRP (serie diaria), consultada el 2026-10-17.
const sample = {
  config: { title: 'Tipo de cambio', series: [{ name: 'Tipo de cambio - TC Interbancario (S/ por US$) - Venta', dec: '3' }] },
  periods: [
    { name: '14.Oct.26', values: ['3.44'] },
    { name: '15.Oct.26', values: ['3.432'] },
    { name: '16.Oct.26', values: ['n.d.'] },
  ],
};

describe('parseBcrpDate', () => {
  it('convierte el formato del BCRP', () => {
    expect(parseBcrpDate('15.Oct.26')).toBe('2026-10-15');
    expect(parseBcrpDate('01.Set.26')).toBe('2026-09-01');
    expect(parseBcrpDate('03.Ene.27')).toBe('2027-01-03');
  });
  it('rechaza formatos raros', () => expect(parseBcrpDate('2026-10-15')).toBeNull());
});

describe('pickRate', () => {
  it('toma el último valor disponible, saltando "n.d."', () => {
    expect(pickRate(sample, '2026-10-17')).toEqual({ date: '2026-10-15', value: 3.432 });
  });
  it('no usa valores posteriores a la fecha pedida', () => {
    expect(pickRate(sample, '2026-10-14')).toEqual({ date: '2026-10-14', value: 3.44 });
  });
  it('sin datos devuelve null', () => expect(pickRate({ periods: [] }, '2026-10-14')).toBeNull());
});
