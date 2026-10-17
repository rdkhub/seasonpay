-- =====================================================================
-- Montana: overtime estatal (MCA 39-3-405, versión MCA 2025).
-- Verificado en la fuente el 2026-10-17. Pendiente de revisión del Enrolled Agent.
-- Debe coincidir con src/data/seed/rules.json.
-- =====================================================================

insert into public.tax_rules (key, jurisdiction, year, value, source_url, verified_at, reviewed_by, notes)
values
  (
    'overtime_weekly',
    'MT',
    2026,
    '{
      "threshold_hours": 40,
      "multiplier": 1.5,
      "statute": "MCA 39-3-405(1)"
    }'::jsonb,
    'https://mca.legmt.gov/bills/mca/title_0390/chapter_0030/part_0040/section_0050/0390-0030-0040-0050.html',
    '2026-10-17',
    'pendiente Enrolled Agent',
    'Montana: horas sobre 40 en la semana laboral a no menos de 1.5 veces la tarifa por hora. No aplica a trabajadores agrícolas (39-3-405(2)).'
  ),
  (
    'overtime_seasonal_student_notice',
    'MT',
    2026,
    '{
      "statute": "MCA 39-3-405(3)",
      "threshold_hours": 48,
      "multiplier": 1.5,
      "applies_to": "students employed at an amusement or recreational area that operates on a seasonal basis, when the employer furnishes board, lodging or other facilities",
      "show_as": "notice"
    }'::jsonb,
    'https://mca.legmt.gov/bills/mca/title_0390/chapter_0030/part_0040/section_0050/0390-0030-0040-0050.html',
    '2026-10-17',
    'pendiente Enrolled Agent',
    'Solo aviso. La app no decide si aplica; el usuario puede ajustar el umbral de su empleador a 48 h si su empleador lo confirma.'
  )
on conflict (key, jurisdiction, year) do update
  set value = excluded.value,
      source_url = excluded.source_url,
      verified_at = excluded.verified_at,
      reviewed_by = excluded.reviewed_by,
      notes = excluded.notes,
      updated_at = now();
