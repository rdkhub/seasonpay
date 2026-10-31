import { describe, expect, it } from 'vitest';
import { parseBcra, parsePtax, parseTrm, pickLatest, SOURCES } from './fx-local.js';

// Respuestas reales (recortadas) verificadas el 2026-10-30.
const bcra = {
  status: 200,
  results: [
    { fecha: '2026-10-30', detalle: [{ codigoMoneda: 'USD', descripcion: 'DOLAR E.E.U.U.', tipoPase: 0, tipoCotizacion: 1534 }] },
    { fecha: '2026-10-29', detalle: [{ codigoMoneda: 'USD', descripcion: 'DOLAR E.E.U.U.', tipoPase: 0, tipoCotizacion: 1539 }] },
  ],
};
const ptax = { value: [{ cotacaoCompra: 5.3738, cotacaoVenda: 5.3744, dataHoraCotacao: '2026-10-29 13:11:53.555689' }] };
const trm = [
  { valor: '3182.99', unidad: 'COP', vigenciadesde: '2026-10-31T00:00:00.000', vigenciahasta: '2026-11-03T00:00:00.000' },
  { valor: '3166.91', unidad: 'COP', vigenciadesde: '2026-10-30T00:00:00.000', vigenciahasta: '2026-10-30T00:00:00.000' },
];

describe('fx-local', () => {
  it('BCRA: toma el dólar del día', () => {
    expect(pickLatest(parseBcra(bcra), '2026-10-30')).toEqual({ date: '2026-10-30', value: 1534 });
    expect(pickLatest(parseBcra(bcra), '2026-10-29')).toEqual({ date: '2026-10-29', value: 1539 });
  });

  it('PTAX: usa la cotización de venta', () => {
    expect(pickLatest(parsePtax(ptax), '2026-10-30')).toEqual({ date: '2026-10-29', value: 5.3744 });
  });

  it('TRM: si la fecha cae dentro de la vigencia (fin de semana), vale para esa fecha', () => {
    const r = pickLatest(parseTrm(trm, '2026-11-01'), '2026-11-01');
    expect(r?.value).toBe(3182.99);
    expect(r?.date).toBe('2026-11-01');
    expect(pickLatest(parseTrm(trm, '2026-10-30'), '2026-10-30')?.value).toBe(3166.91);
  });

  it('no devuelve valores posteriores a la fecha pedida', () => {
    expect(pickLatest(parseBcra(bcra), '2026-10-28')).toBeNull();
  });

  it('arma las URLs oficiales', () => {
    expect(SOURCES.ARS.url('2026-10-24', '2026-10-30')).toBe('https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD?fechadesde=2026-10-24&fechahasta=2026-10-30');
    expect(SOURCES.BRL.url('2026-10-24', '2026-10-30')).toContain("@dataInicial='10-24-2026'&@dataFinalCotacao='10-30-2026'");
    expect(SOURCES.COP.url('2026-10-24', '2026-10-30')).toContain('datos.gov.co/resource/32sa-8pi3.json');
  });
});
