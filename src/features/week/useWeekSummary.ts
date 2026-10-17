import { useMemo } from 'react';
import { addDays, startOfDay, summarizePeriod, weekRange, type PeriodSummary } from '@/domain';
import type { EmployerRow, ShiftRow } from '@/data/db';
import { useEmployers, useShiftsInRange } from '@/data/hooks';
import { toEmployerConfig, toShiftInput } from '@/data/mappers';

export interface WeekData {
  loading: boolean;
  range: { from: number; to: number };
  weekStartDay: number;
  summary: PeriodSummary;
  /** Turnos que empiezan dentro de la semana mostrada */
  shifts: ShiftRow[];
  /** Turnos de la semana y vecinas (los necesita el cálculo de overtime) */
  contextShifts: ShiftRow[];
  employers: EmployerRow[];
  employerById: Map<string, EmployerRow>;
}

/**
 * Semana que se muestra: empieza el día de la semana laboral del primer empleador activo.
 * Para el overtime se cargan también 7 días antes y después, porque cada empleador
 * puede tener una semana laboral distinta.
 */
export function useWeekSummary(anchor: number, now: number): WeekData {
  const allEmployers = useEmployers(true);
  const weekStartDay = allEmployers?.find((e) => !e.archived)?.workweekStartDay ?? 1;
  const range = useMemo(() => weekRange(anchor, weekStartDay), [anchor, weekStartDay]);
  const ctxFrom = addDays(range.from, -7);
  const ctxTo = addDays(range.to, 7);
  const contextShifts = useShiftsInRange(ctxFrom, ctxTo);

  return useMemo(() => {
    const employers = allEmployers ?? [];
    const ctx = contextShifts ?? [];
    const summary = summarizePeriod({
      shifts: ctx.map(toShiftInput),
      employers: employers.map(toEmployerConfig),
      range,
      now,
    });
    return {
      loading: allEmployers === undefined || contextShifts === undefined,
      range,
      weekStartDay,
      summary,
      shifts: ctx.filter((s) => s.startedAt >= range.from && s.startedAt < range.to),
      contextShifts: ctx,
      employers,
      employerById: new Map(employers.map((e) => [e.id, e])),
    };
  }, [allEmployers, contextShifts, range, now, weekStartDay]);
}

/** Resumen de un día usando el mismo contexto (el overtime ya viene repartido bien). */
export function summarizeDay(data: WeekData, day: number, now: number): PeriodSummary {
  const from = startOfDay(day);
  return summarizePeriod({
    shifts: data.contextShifts.map(toShiftInput),
    employers: data.employers.map(toEmployerConfig),
    range: { from, to: addDays(from, 1) },
    now,
  });
}
