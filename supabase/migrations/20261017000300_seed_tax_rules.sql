-- =====================================================================
-- Reglas iniciales. Deben coincidir con src/data/seed/rules.json
-- (la copia local que usa la app sin internet).
-- Verificadas en la fuente el 2026-10-17. Pendientes de revisión del Enrolled Agent.
-- =====================================================================

insert into public.tax_rules (key, jurisdiction, year, value, source_url, verified_at, reviewed_by, notes)
values
  (
    'overtime_weekly',
    'federal',
    2026,
    '{
      "threshold_hours": 40,
      "multiplier": 1.5,
      "averaging_allowed": false,
      "workweek": "fixed 168-hour period (7 consecutive 24-hour periods); may start on any day and hour"
    }'::jsonb,
    'https://www.dol.gov/agencies/whd/overtime',
    '2026-10-17',
    'pendiente Enrolled Agent',
    'FLSA: horas sobre 40 en la semana laboral a 1.5 veces la tarifa regular. No se promedian semanas.'
  ),
  (
    'overtime_seasonal_exemption_notice',
    'federal',
    2026,
    '{
      "flsa_section": "13(a)(3)",
      "applies_to": "seasonal amusement or recreational establishments",
      "effect": "employees may be exempt from federal minimum wage and overtime",
      "show_as": "notice"
    }'::jsonb,
    'https://www.dol.gov/agencies/whd/fact-sheets/18-flsa-seasonal-amusement',
    '2026-10-17',
    'pendiente Enrolled Agent',
    'Solo se muestra como aviso informativo. La app no decide si aplica: el usuario lo confirma con su empleador.'
  )
on conflict (key, jurisdiction, year) do update
  set value = excluded.value,
      source_url = excluded.source_url,
      verified_at = excluded.verified_at,
      reviewed_by = excluded.reviewed_by,
      notes = excluded.notes,
      updated_at = now();
