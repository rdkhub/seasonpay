-- =====================================================================
-- Doble tiempo y 7.º día en el cálculo de overtime (antes solo se avisaba).
-- California (DIR/DLSE, Labor Code 510): 2x después de 12 h en un día y después de 8 h el
--   7.º día seguido de la semana laboral; las primeras 8 h del 7.º día a 1.5x.
-- Kentucky (KRS 337.050): 1.5x por las horas del 7.º día si se trabajaron los 7 días de la
--   semana laboral; no aplica si en la semana no se pasa de 40 h.
-- Verificado 2026-10-31. Pendiente de revisión del Enrolled Agent.
-- =====================================================================

update public.tax_rules
  set value = value || '{"double_time_multiplier": 2, "seventh_day_rule": "ca"}'::jsonb,
      verified_at = '2026-10-31'
  where key = 'overtime_state' and jurisdiction = 'CA';

update public.tax_rules
  set value = value || '{"seventh_day_rule": "ky", "seventh_day_min_weekly_hours": 40}'::jsonb,
      verified_at = '2026-10-31',
      notes = coalesce(notes, '') || '; 7.º día según KRS 337.050 (no aplica si no se trabajan más de 40 h en la semana)'
  where key = 'overtime_state' and jurisdiction = 'KY';
