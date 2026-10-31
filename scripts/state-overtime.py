"""
Genera la regla overtime_state para los 50 estados y DC.

Fuente general: U.S. Department of Labor, "State Minimum Wage Laws" (sección
"Premium Pay After Designated Hours"), actualizada el 1-jul-2026, verificada el 2026-10-30.
Los estados con overtime diario se confirmaron además en la fuente estatal:
  AK: Summary of Alaska Wage and Hour Act (rev. 01-2025)
  CA: DIR/DLSE, Overtime FAQ (Labor Code 510)
  CO: CDLE, INFO #1 COMPS Order #39
  NV: NRS 608.018

Salida: src/data/seed/rules.json (agrega/reemplaza overtime_state) y
supabase/migrations/20261030000900_state_overtime.sql
"""
import json
import pathlib

DOL = 'https://www.dol.gov/agencies/whd/minimum-wage/state'
VERIFIED = '2026-10-30'
YEAR = 2026
ROOT = pathlib.Path(__file__).resolve().parent.parent

STATE_SRC = {
    'AK': 'https://labor.alaska.gov/lss/forms/Summary_of_Alaska_Wage_and_Hour_Act__Rev_01-25.pdf',
    'CA': 'https://www.dir.ca.gov/dlse/faq_overtime.htm',
    'CO': 'https://cdle.colorado.gov/sites/cdle/files/INFO%20%231%20COMPS%20Order%20%2339%20(2024)%2012.8.23%20%5Baccessible%5D.pdf',
    'NV': 'https://www.leg.state.nv.us/nrs/nrs-608.html',
}

NO_STATE_LAW = ['AL', 'LA', 'MS', 'SC', 'TN']          # "No state minimum wage law."
FLSA_EXCLUDED = ['GA', 'KS', 'OK', 'TX', 'UT']         # "excludes from coverage any employment subject to the FLSA"
NO_PREMIUM = ['AZ', 'DE', 'FL', 'ID', 'IA', 'NE', 'SD', 'VA', 'WY']  # sin línea de premium pay
WEEKLY_40 = ['AR', 'CT', 'DC', 'HI', 'IL', 'IN', 'ME', 'MD', 'MA', 'MI', 'MO', 'MT', 'NH', 'NJ', 'NM', 'NY',
             'NC', 'ND', 'OH', 'OR', 'PA', 'RI', 'VT', 'WA', 'WV', 'WI', 'KY']

rules = {}


def base(**kw):
    v = {
        'weekly_hours': None,
        'daily_hours': None,
        'daily_double_time_hours': None,
        'seventh_day': False,
        'daily_applies_to_all': False,
        'seasonal_recreation_weekly_hours': None,
        'no_state_law': False,
        'excludes_flsa_covered': False,
        'no_state_overtime': False,
        'multiplier': 1.5,
        'notes': [],
    }
    v.update(kw)
    return v


for s in NO_STATE_LAW:
    rules[s] = base(no_state_law=True)
for s in FLSA_EXCLUDED:
    rules[s] = base(excludes_flsa_covered=True)
for s in NO_PREMIUM:
    rules[s] = base(no_state_overtime=True)
for s in WEEKLY_40:
    rules[s] = base(weekly_hours=40)

rules['MN'] = base(weekly_hours=48)
rules['KY']['seventh_day'] = True
# KRS 337.050: 1.5x por las horas del 7.º día si se trabajaron los 7 días de la semana laboral;
# no aplica si el empleado no trabaja más de 40 h en la semana. Verificado 2026-10-31.
rules['KY']['seventh_day_rule'] = 'ky'
rules['KY']['seventh_day_min_weekly_hours'] = 40
rules['KY']['notes'] = ['ky_seventh_day']
rules['MO']['seasonal_recreation_weekly_hours'] = 52
rules['MO']['notes'] = ['seasonal_recreation_weekly']
rules['NC']['seasonal_recreation_weekly_hours'] = 45
rules['NC']['notes'] = ['seasonal_recreation_weekly']
rules['NY']['notes'] = ['ny_live_in_44']
rules['OR']['notes'] = ['or_industries_10']
rules['RI']['notes'] = ['ri_sunday_holiday']
rules['WA']['notes'] = ['wa_comp_time']
rules['MT']['notes'] = ['mt_student_48']

rules['AK'] = base(weekly_hours=40, daily_hours=8, daily_applies_to_all=True, notes=['ak_small_employers'])
rules['CA'] = base(weekly_hours=40, daily_hours=8, daily_double_time_hours=12, seventh_day=True, daily_applies_to_all=True,
                   notes=['ca_double_time', 'ca_seventh_day'])
# DLSE (Labor Code 510): doble (2x) después de 12 h en el día y después de 8 h el 7.º día seguido.
rules['CA']['double_time_multiplier'] = 2
rules['CA']['seventh_day_rule'] = 'ca'
rules['CO'] = base(weekly_hours=40, daily_hours=12, daily_applies_to_all=True, notes=['co_12_consecutive'])
rules['NV'] = base(weekly_hours=40, daily_hours=8, daily_applies_to_all=False, notes=['nv_wage_condition'])

assert len(rules) == 51, len(rules)


def row(state):
    return {
        'key': 'overtime_state',
        'jurisdiction': state,
        'year': YEAR,
        'value': rules[state],
        'source_url': STATE_SRC.get(state, DOL),
        'verified_at': VERIFIED,
        'reviewed_by': 'pendiente Enrolled Agent',
    }


# Seed local
seed_path = ROOT / 'src/data/seed/rules.json'
seed = json.loads(seed_path.read_text(encoding='utf-8'))
seed['rules'] = [r for r in seed['rules'] if r['key'] != 'overtime_state'] + [row(s) for s in sorted(rules)]
seed_path.write_text(json.dumps(seed, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Migración
def sql_str(x):
    return "'" + x.replace("'", "''") + "'"

values = ',\n'.join(
    f"  ('overtime_state', {sql_str(json.dumps(rules[s], ensure_ascii=False))}::jsonb, {YEAR}, '{s}', {sql_str(STATE_SRC.get(s, DOL))}, '{VERIFIED}', 'pendiente Enrolled Agent',"
    f" {sql_str('DOL State Minimum Wage Laws (premium pay), actualizada 1-jul-2026' + ('; confirmado en fuente estatal' if s in STATE_SRC else ''))})"
    for s in sorted(rules)
)
sql = f"""-- =====================================================================
-- Overtime por estado (50 estados + DC). Generado por scripts/state-overtime.py.
-- Fuente: DOL "State Minimum Wage Laws" (Premium Pay After Designated Hours), actualizada 1-jul-2026.
-- Overtime diario confirmado en la fuente estatal: AK, CA, CO, NV.
-- La ley federal (FLSA, 40 h/semana) sigue aplicando a empleadores cubiertos; la regla estatal
-- solo suma derechos (por ejemplo, overtime diario).
-- También agrega employers.overtime_daily_hours.
-- =====================================================================

alter table public.employers
  add column if not exists overtime_daily_hours numeric(4, 1) check (overtime_daily_hours is null or (overtime_daily_hours > 0 and overtime_daily_hours <= 24));

comment on column public.employers.overtime_daily_hours is 'Overtime diario (horas por día). null = sin overtime diario. Valor inicial desde tax_rules.overtime_state.';

insert into public.tax_rules (key, value, year, jurisdiction, source_url, verified_at, reviewed_by, notes) values
{values}
on conflict (key, jurisdiction, year) do update
  set value = excluded.value, source_url = excluded.source_url, verified_at = excluded.verified_at, notes = excluded.notes;
"""
(ROOT / 'supabase/migrations/20261030000900_state_overtime.sql').write_text(sql, encoding='utf-8')
print('ok', len(rules))
