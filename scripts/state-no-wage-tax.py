"""
Estados sin impuesto estatal a los sueldos + fecha límite de Utah + regla de fin de semana del 1040-NR.
Verificado el 2026-10-30 en la fuente oficial de cada estado (o agencia estatal cuando el
departamento de impuestos no lo publica de forma explícita). Alaska queda pendiente: no se encontró
una página oficial que lo diga de forma explícita.

Salida: src/data/seed/rules.json y supabase/migrations/20261031001020_state_no_wage_tax.sql
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
V = '2026-10-30'
YEAR = 2026
EA = 'pendiente Enrolled Agent'


def none_rule(state, agency, url, quote, es_extra='', en_extra=''):
    # agency: (es, en)
    a_es, a_en = agency
    return {
        'key': 'state_return_nonresident',
        'jurisdiction': state,
        'year': YEAR,
        'value': {
            'no_wage_tax': True,
            'agency': a_en,
            'quote': quote,
            'summary': {
                'es': f'Según {a_es}, el estado no cobra impuesto a los sueldos, así que por tu sueldo ahí no tendrías declaración estatal.{es_extra} Confírmalo en la fuente.',
                'en': f'According to {a_en}, the state doesn’t tax wages, so you wouldn’t have a state return for your wages there.{en_extra} Confirm it at the source.',
            },
        },
        'source_url': url,
        'verified_at': V,
        'reviewed_by': EA,
        'notes': f'Cita textual: "{quote}"',
    }


RULES = [
    none_rule('FL', ('el Florida Department of Revenue', 'the Florida Department of Revenue'), 'https://floridarevenue.com/faq/Pages/FAQDetails.aspx?FAQID=1466',
              'Florida does not impose a personal income tax, so there are no filing requirements.'),
    none_rule('NH', ('el New Hampshire Department of Revenue Administration', 'the New Hampshire Department of Revenue Administration'), 'https://www.revenue.nh.gov/taxes-glance/interest-dividends-tax',
              "The State of New Hampshire does not have an income tax on an individual's reported W-2 wages."),
    none_rule('NV', ('el Nevada Department of Taxation', 'the Nevada Department of Taxation'), 'https://tax.nv.gov/about-nevada-department-of-taxation/income-tax-in-nevada/',
              'While Nevada does not have an individual income tax, it does levy other types of taxes, such as sales tax and property tax.'),
    none_rule('SD', ('el South Dakota Department of Revenue', 'the South Dakota Department of Revenue'), 'https://dor.sd.gov/individuals/taxes/',
              'South Dakota is one of seven states that does not impose a state income tax.'),
    none_rule('TN', ('el Tennessee Department of Revenue', 'the Tennessee Department of Revenue'), 'https://revenue.support.tn.gov/hc/en-us/articles/360057828631-HIT-3-Hall-Income-Tax-Repealed-Beginning-January-1-2021',
              'The tax is fully repealed beginning January 1, 2021.',
              ' El único impuesto a la renta que tenía (Hall, sobre intereses y dividendos) se eliminó desde 2021.',
              ' Its only income tax (Hall, on interest and dividends) was repealed starting in 2021.'),
    none_rule('TX', ('la Texas Economic Development Corporation (socia de la oficina del gobernador de Texas)', 'the Texas Economic Development Corporation (partner of the Texas Governor’s office)'), 'https://businessintexas.com/why-texas/taxes-incentives/taxes/',
              'With no corporate or personal income tax, Texas has one of the lowest tax burdens in the nation.'),
    none_rule('WA', ('el Washington Department of Revenue', 'the Washington Department of Revenue'), 'https://dor.wa.gov/taxes-rates/income-tax',
              'Washington does not currently have an individual income tax.',
              ' Desde 2028 habrá un impuesto solo para ingresos de más de 1 millón de dólares al año.',
              ' Starting in 2028 there will be a tax only on income over 1 million dollars a year.'),
    none_rule('WY', ('el Wyoming Business Council (agencia del estado, revista Why Wyoming de sept. 2025)', 'the Wyoming Business Council (state agency, Why Wyoming magazine, Sept. 2025)'),
              'https://wyomingbusiness.org/wp-content/uploads/2025/09/25_WhyWyoming_Mag_Digital.pdf',
              'Businesses and individuals operating in Wyoming are not subject to state income taxes.'),
    {
        'key': 'state_return_due_date',
        'jurisdiction': 'UT',
        'year': YEAR,
        'value': {'calendar_year': '04-15', 'extension': '10-15', 'form': 'TC-40',
                  'note': 'Automatic 6-month extension to file, not to pay; Saturday/Sunday/legal holiday moves to next business day'},
        'source_url': 'https://incometax.utah.gov/general-instructions/',
        'verified_at': V,
        'reviewed_by': EA,
        'notes': 'Utah State Tax Commission, General Instructions (When to File and Pay).',
    },
]

# Regla federal: se confirma la regla de fin de semana / feriado (Pub. 519 2025, "When To File")
FED_WEEKEND_URL = 'https://www.irs.gov/publications/p519'

seed_path = ROOT / 'src/data/seed/rules.json'
seed = json.loads(seed_path.read_text(encoding='utf-8'))
ids = {(r['key'], r['jurisdiction'], r['year']) for r in RULES}
seed['rules'] = [r for r in seed['rules'] if (r['key'], r['jurisdiction'], r['year']) not in ids] + RULES
for r in seed['rules']:
    if r['key'] == 'form_1040nr_due_date' and r['jurisdiction'] == 'federal':
        r['value']['weekend_holiday_rule_verified'] = True
        r['value']['weekend_holiday_rule'] = 'If the regular due date falls on a Saturday, Sunday, or legal holiday, the due date is the next day that is not a Saturday, Sunday, or legal holiday.'
        r['value']['weekend_holiday_source'] = FED_WEEKEND_URL
        r['verified_at'] = V
seed_path.write_text(json.dumps(seed, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def q(s):
    return "'" + s.replace("'", "''") + "'"


values = ',\n'.join(
    f"  ({q(r['key'])}, {q(json.dumps(r['value'], ensure_ascii=False))}::jsonb, {r['year']}, {q(r['jurisdiction'])}, {q(r['source_url'])}, {q(r['verified_at'])}, {q(r['reviewed_by'])}, {q(r['notes'])})"
    for r in RULES
)
sql = f"""-- =====================================================================
-- Estados sin impuesto a los sueldos (FL, NH, NV, SD, TN, TX, WA, WY), fecha límite de Utah
-- y regla de fin de semana / feriado del 1040-NR. Verificado {V}. Generado por scripts/state-no-wage-tax.py.
-- Alaska: pendiente (sin página oficial explícita).
-- =====================================================================

insert into public.tax_rules (key, value, year, jurisdiction, source_url, verified_at, reviewed_by, notes) values
{values}
on conflict (key, jurisdiction, year) do update
  set value = excluded.value, source_url = excluded.source_url, verified_at = excluded.verified_at, notes = excluded.notes;

update public.tax_rules
  set value = value || jsonb_build_object(
        'weekend_holiday_rule_verified', true,
        'weekend_holiday_rule', 'If the regular due date falls on a Saturday, Sunday, or legal holiday, the due date is the next day that is not a Saturday, Sunday, or legal holiday.',
        'weekend_holiday_source', {q(FED_WEEKEND_URL)}),
      verified_at = '{V}'
  where key = 'form_1040nr_due_date' and jurisdiction = 'federal';
"""
(ROOT / 'supabase/migrations/20261031001020_state_no_wage_tax.sql').write_text(sql, encoding='utf-8')
print('ok', len(RULES))
