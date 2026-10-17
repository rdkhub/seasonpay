import type { TFunction } from 'i18next';
import { addDays, assessFica, dayKey, startOfDay, timeKey, summarizePeriod, summarizeSavings, type FicaStatus } from '@/domain';
import { db } from '@/data/db';
import { toEmployerConfig, toShiftInput } from '@/data/mappers';
import { listEmployers } from '@/data/repos/employers';
import { listPaystubs } from '@/data/repos/paystubs';
import { listRules } from '@/data/repos/rules';
import { listSavings } from '@/data/repos/savings';
import { ficaRulesFrom, priorYearsOf } from '@/features/paystubs/useFica';
import { formatDateISO, formatHours, formatMoney, formatPen } from '@/shared/lib/format';
import { centsToDecimal, minutesToHours, toCsv } from './csv';

export type ExportRange = 'all' | 'thisYear';

/** Junta todo lo que va al PDF y a los CSV, ya filtrado por el periodo elegido. */
export async function gatherExport(range: ExportRange, now = Date.now()) {
  const year = String(new Date(now).getFullYear());
  const inRange = (isoDate: string) => range === 'all' || isoDate.startsWith(year);

  const [allShifts, employers, paystubsAll, savingsAll, rules, profile] = await Promise.all([
    db.shifts.toArray(),
    listEmployers({ includeArchived: true }),
    listPaystubs(),
    listSavings(),
    listRules(),
    db.profile.get('me'),
  ]);
  const shifts = allShifts.filter((s) => s.deletedAt === null && inRange(dayKey(s.startedAt))).sort((a, b) => a.startedAt - b.startedAt);
  const paystubs = paystubsAll.filter((p) => inRange(p.payDate));
  const savings = savingsAll.filter((s) => inRange(s.date));

  const from = shifts.length ? startOfDay(shifts[0]!.startedAt) : now;
  const to = shifts.length ? addDays(startOfDay(shifts[shifts.length - 1]!.startedAt), 1) : now;
  const work = summarizePeriod({
    shifts: allShifts.filter((s) => s.deletedAt === null).map(toShiftInput),
    employers: employers.map(toEmployerConfig),
    range: { from, to },
    now,
  });

  const stubTotals = paystubs.reduce(
    (a, p) => ({
      gross: a.gross + p.grossCents,
      federal: a.federal + p.federalTaxCents,
      state: a.state + p.stateTaxCents,
      ss: a.ss + p.socialSecurityCents,
      medicare: a.medicare + p.medicareCents,
      net: a.net + p.netCents,
    }),
    { gross: 0, federal: 0, state: 0, ss: 0, medicare: 0, net: 0 },
  );

  const fica = assessFica({
    visaType: profile?.visaType ?? null,
    priorYearsInStatus: priorYearsOf(profile, now),
    rules: ficaRulesFrom(rules),
    withheldCents: stubTotals.ss + stubTotals.medicare,
  });

  const savingsSummary = summarizeSavings(savings, profile?.savingsGoalCents ?? null);
  const employerName = new Map(employers.map((e) => [e.id, e.name]));
  return { shifts, paystubs, savings, employers, employerName, work, stubTotals, fica, savingsSummary, rules, from, to, now };
}

export type ExportData = Awaited<ReturnType<typeof gatherExport>>;

/** "2026-10-05 08:00" en hora local del celular */
const localStamp = (ms: number) => `${dayKey(ms)} ${timeKey(ms)}`;

export function buildCsvFiles(d: ExportData): File[] {
  const shiftsCsv = toCsv(
    ['fecha', 'empleador', 'entrada', 'salida', 'descanso_min', 'horas_trabajadas', 'horas_normales', 'horas_extra', 'propinas_efectivo', 'propinas_tarjeta', 'nota'],
    d.shifts.map((s) => {
      const b = d.work.byShift.get(s.id);
      return [
        dayKey(s.startedAt),
        d.employerName.get(s.employerId) ?? '',
        localStamp(s.startedAt),
        s.endedAt ? localStamp(s.endedAt) : '',
        s.breakMinutes,
        minutesToHours(b?.workedMinutes ?? 0),
        minutesToHours(b?.regularMinutes ?? 0),
        minutesToHours(b?.overtimeMinutes ?? 0),
        centsToDecimal(s.cashTipsCents),
        centsToDecimal(s.cardTipsCents),
        s.note,
      ];
    }),
  );
  const stubsCsv = toCsv(
    ['fecha_pago', 'empleador', 'periodo_desde', 'periodo_hasta', 'horas_normales', 'horas_extra', 'bruto', 'propinas', 'federal', 'estatal', 'social_security', 'medicare', 'otros', 'neto'],
    d.paystubs.map((p) => [
      p.payDate,
      d.employerName.get(p.employerId) ?? '',
      p.periodStart,
      p.periodEnd,
      minutesToHours(p.regularMinutes),
      minutesToHours(p.overtimeMinutes),
      centsToDecimal(p.grossCents),
      centsToDecimal(p.tipsCents),
      centsToDecimal(p.federalTaxCents),
      centsToDecimal(p.stateTaxCents),
      centsToDecimal(p.socialSecurityCents),
      centsToDecimal(p.medicareCents),
      centsToDecimal(p.otherDeductionsCents),
      centsToDecimal(p.netCents),
    ]),
  );
  const savingsCsv = toCsv(
    ['fecha', 'tipo', 'usd', 'tipo_cambio', 'fecha_tipo_cambio', 'fuente_tipo_cambio', 'soles', 'nota'],
    d.savings.map((s) => [
      s.date,
      s.kind === 'save' ? 'ahorro' : 'retiro',
      centsToDecimal(s.amountCents),
      s.fxRate,
      s.fxDate,
      s.fxSource,
      s.fxRate ? centsToDecimal(Math.round(s.amountCents * s.fxRate)) : '',
      s.note,
    ]),
  );
  const type = { type: 'text/csv;charset=utf-8' };
  return [
    new File([shiftsCsv], 'seasonpay-turnos.csv', type),
    new File([stubsCsv], 'seasonpay-boletas.csv', type),
    new File([savingsCsv], 'seasonpay-ahorro.csv', type),
  ];
}

const FICA_TEXT_KEYS: Record<FicaStatus, string> = {
  possibly_exempt: 'fica.possibly_exempt',
  may_be_resident: 'fica.may_be_resident',
  no_exemption_found: 'fica.no_exemption_found',
  unknown: 'fica.unknown',
};

/** PDF de una página (o más) con el resumen. jsPDF se carga solo cuando se usa. */
export async function buildPdf(d: ExportData, t: TFunction, lang: string): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, x: number, size = 11, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [20, 28, 44]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(s, x, y);
  };
  const section = (title: string) => {
    ensure(40);
    y += 18;
    doc.setDrawColor(30, 108, 229);
    doc.setLineWidth(2);
    doc.line(M, y, M + 24, y);
    y += 18;
    text(title, M, 13, 'bold');
    y += 8;
  };
  const row = (label: string, value: string) => {
    ensure(20);
    y += 16;
    text(label, M, 10.5, 'normal', [74, 85, 104]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(20, 28, 44);
    doc.text(value, W - M, y, { align: 'right' });
    doc.setDrawColor(226, 231, 238);
    doc.setLineWidth(0.5);
    doc.line(M, y + 6, W - M, y + 6);
  };
  const para = (s: string, size = 9.5) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(74, 85, 104);
    const lines = doc.splitTextToSize(s, W - 2 * M) as string[];
    for (const l of lines) {
      ensure(14);
      y += 13;
      doc.text(l, M, y);
    }
  };
  const m = (c: number) => formatMoney(c, lang);

  // Encabezado
  doc.setFillColor(18, 58, 122);
  doc.rect(0, 0, W, 96, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SeasonPay', M, 46);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(t('export.pdfTitle'), M, 68);
  doc.setFontSize(9.5);
  doc.text(t('export.generated', { date: formatDateISO(dayKey(d.now), lang) }), W - M, 46, { align: 'right' });
  if (d.shifts.length) {
    doc.text(t('export.period', { from: formatDateISO(dayKey(d.from), lang), to: formatDateISO(dayKey(addDays(d.to, -1)), lang) }), W - M, 68, { align: 'right' });
  }
  y = 110;

  section(t('export.secWork'));
  row(t('export.shiftsCount'), String(d.work.shiftCount));
  row(t('export.regularHours'), formatHours(d.work.regularMinutes));
  row(t('export.overtimeHours'), formatHours(d.work.overtimeMinutes));
  row(t('export.cashTips'), m(d.work.cashTipsCents));
  row(t('export.cardTips'), m(d.work.cardTipsCents));
  row(t('export.estGross'), m(d.work.grossCents));
  for (const e of d.work.byEmployer) row(`  ${d.employerName.get(e.employerId) ?? ''}`, m(e.grossCents));

  section(t('export.secPaystubs'));
  row(t('export.stubsCount'), String(d.paystubs.length));
  row(t('export.gross'), m(d.stubTotals.gross));
  row(t('export.federal'), m(d.stubTotals.federal));
  row(t('export.state'), m(d.stubTotals.state));
  row(t('export.ss'), m(d.stubTotals.ss));
  row(t('export.medicare'), m(d.stubTotals.medicare));
  row(t('export.net'), m(d.stubTotals.net));

  section(t('export.secFica'));
  row(t('fica.cardTitle'), t(FICA_TEXT_KEYS[d.fica.status]));
  para(t(`fica.${d.fica.status}Body`, { year: d.fica.yearInStatus ?? '—' }));

  section(t('export.secSavings'));
  row(t('export.saved'), m(d.savingsSummary.balanceCents));
  row(t('export.savedPen'), formatPen(d.savingsSummary.balancePenCents, lang));

  section(t('export.secSources'));
  const used = d.rules.filter((r) => ['overtime_weekly', 'fica_exemption_nonresident_fjmq', 'fica_refund_procedure', 'form_8843_filing', 'fx_usd_pen_series'].includes(r.key));
  for (const r of used) {
    para(`${t(`rules.${r.key}_${r.jurisdiction}`, { defaultValue: t(`rules.${r.key}`, { defaultValue: r.key }) })} (${r.jurisdiction} ${r.year}) · ${r.sourceUrl} · ${t('common.verifiedOn', { date: formatDateISO(r.verifiedAt, lang) })}`, 8.5);
  }

  y += 10;
  para(t('export.disclaimer'), 9);

  const blob = doc.output('blob');
  return new File([blob], `seasonpay-resumen-${dayKey(d.now)}.pdf`, { type: 'application/pdf' });
}
