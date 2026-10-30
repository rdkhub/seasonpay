import { describe, expect, it } from 'vitest';
import { parseBcrpDate, parseSunat, pickRate, sunatFits } from './fx.js';

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

describe('respaldo SUNAT', () => {
  it('lee el archivo de SUNAT (fecha|compra|venta)', () => {
    // Contenido real del archivo el 2026-10-30
    expect(parseSunat('30/10/2026|3.455|3.461|')).toEqual({ date: '2026-10-30', buy: 3.455, sell: 3.461 });
    expect(parseSunat('30/10/2026|3.455|3.461|\n')).toEqual({ date: '2026-10-30', buy: 3.455, sell: 3.461 });
  });
  it('rechaza contenido raro (por ejemplo una página HTML)', () => {
    expect(parseSunat('<!DOCTYPE html>')).toBeNull();
    expect(parseSunat('30/10/2026|0|0|')).toBeNull();
  });
  it('solo sirve para el mismo día o hasta 6 días después', () => {
    expect(sunatFits('2026-10-30', '2026-10-30')).toBe(true);
    expect(sunatFits('2026-10-30', '2026-11-02')).toBe(true);
    expect(sunatFits('2026-10-30', '2026-11-05')).toBe(true);
    expect(sunatFits('2026-10-30', '2026-11-06')).toBe(false);
    expect(sunatFits('2026-10-30', '2026-10-29')).toBe(false);
  });
});
