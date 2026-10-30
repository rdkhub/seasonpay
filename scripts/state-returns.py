"""
Declaración estatal de no residentes y fechas límite (estados de ski).
Verificado el 2026-10-30 en la web de cada departamento de impuestos. Los textos en `summary`
dicen solo lo que dice la fuente. Sin fuente para la fecha límite, no se carga la fecha.
Salida: src/data/seed/rules.json y supabase/migrations/20261030000930_state_returns.sql
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
V = '2026-10-30'
REV = 'pendiente Enrolled Agent'

returns = {
    'CO': ('https://tax.colorado.gov/individual-income-tax-filing-requirements', {
        'must_file_if': 'nonresident with Colorado source income AND (required to file a federal return OR Colorado income tax liability)',
        'summary': {
            'es': 'Según el Colorado Department of Revenue, los no residentes con ingresos de fuente de Colorado declaran si tienen que presentar declaración federal o si tienen impuesto de Colorado por pagar.',
            'en': 'According to the Colorado Department of Revenue, nonresidents with Colorado-source income must file if they are required to file a federal return or have a Colorado tax liability.',
        }}),
    'UT': ('https://incometax.utah.gov/instructions/who-must-file', {
        'must_file_if': 'nonresident with income from Utah sources who must file a federal return',
        'form': 'TC-40',
        'summary': {
            'es': 'Según la Utah State Tax Commission, los no residentes con ingresos de fuente de Utah que deben presentar declaración federal presentan el Form TC-40.',
            'en': 'According to the Utah State Tax Commission, nonresidents with income from Utah sources who must file a federal return file Form TC-40.',
        }}),
    'CA': ('https://www.ftb.ca.gov/file/personal/do-you-need-to-file.html', {
        'must_file_if': 'generally, nonresident who receives income from a source in California (FTB filing thresholds apply)',
        'summary': {
            'es': 'Según el Franchise Tax Board, en general un no residente debe declarar si recibe ingresos de fuente de California. Hay montos mínimos: revísalos en la fuente.',
            'en': 'According to the Franchise Tax Board, a nonresident generally must file if they receive income from a source in California. Minimum amounts apply: check the source.',
        }}),
    'ID': ('https://tax.idaho.gov/taxes/income-tax/individual-income/online-guide/', {
        'must_file_if': 'nonresident with total gross income from Idaho sources over 2500 USD',
        'gross_income_threshold_usd': 2500,
        'form': 'Form 43',
        'summary': {
            'es': 'Según la Idaho State Tax Commission, los no residentes declaran (Form 43) si sus ingresos brutos de fuente de Idaho pasan de $2,500.',
            'en': 'According to the Idaho State Tax Commission, nonresidents file (Form 43) if their gross income from Idaho sources is more than $2,500.',
        }}),
    'VT': ('https://tax.vermont.gov/individuals/who-should-file/nonresident', {
        'must_file_if': 'nonresident with Vermont net income over 100 USD or gross income over 1000 USD',
        'net_income_threshold_usd': 100,
        'gross_income_threshold_usd': 1000,
        'form': 'IN-111 + Schedule IN-113',
        'summary': {
            'es': 'Según el Vermont Department of Taxes, los no residentes declaran (Form IN-111 con Schedule IN-113) si su ingreso neto de Vermont pasa de $100 o su ingreso bruto pasa de $1,000.',
            'en': 'According to the Vermont Department of Taxes, nonresidents file (Form IN-111 with Schedule IN-113) if their Vermont net income is more than $100 or gross income more than $1,000.',
        }}),
}

due = {
    'CO': ('https://tax.colorado.gov/index.php/income-tax-due-dates-filing-extension', {'calendar_year': '04-15', 'extension': '10-15'}),
    'CA': ('https://www.ftb.ca.gov/file/when-to-file/due-dates-personal.html', {'calendar_year': '04-15', 'extension': '10-15', 'note': 'Extension is automatic to file, not to pay'}),
    'ID': ('https://tax.idaho.gov/taxes/income-tax/individual-income/filing-and-paying/', {'calendar_year': '04-15', 'note': 'Extensions do not extend time to pay'}),
    'VT': ('https://tax.vermont.gov/individuals/personal-income-tax', {'calendar_year': '04-15', 'extension': '10-15'}),
}

MT_SUMMARY = {
    'es': 'Según el Montana Department of Revenue, los no residentes con ingresos de fuente de Montana y obligación de declarar a nivel federal también declaran en Montana. Hay una excepción si solo ganaste sueldo por trabajar ahí 30 días o menos y trabajaste en más de un estado.',
    'en': 'According to the Montana Department of Revenue, nonresidents with Montana-source income and a federal filing requirement also file in Montana. There is an exception if you only earned wages for 30 days or less there and worked in more than one state.',
}

rows = []
for st, (url, v) in returns.items():
    rows.append({'key': 'state_return_nonresident', 'jurisdiction': st, 'year': 2026, 'value': v, 'source_url': url, 'verified_at': V, 'reviewed_by': REV})
for st, (url, v) in due.items():
    rows.append({'key': 'state_return_due_date', 'jurisdiction': st, 'year': 2026, 'value': v, 'source_url': url, 'verified_at': V, 'reviewed_by': REV})

p = ROOT / 'src/data/seed/rules.json'
seed = json.loads(p.read_text(encoding='utf-8'))
keys = {(r['key'], r['jurisdiction'], r['year']) for r in rows}
seed['rules'] = [r for r in seed['rules'] if (r['key'], r['jurisdiction'], r['year']) not in keys]
for r in seed['rules']:
    if r['key'] == 'state_return_nonresident' and r['jurisdiction'] == 'MT':
        r['value']['summary'] = MT_SUMMARY
seed['rules'] += rows
p.write_text(json.dumps(seed, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

q = lambda s: "'" + s.replace("'", "''") + "'"
vals = ',\n'.join(f"  ({q(r['key'])}, {q(json.dumps(r['value'], ensure_ascii=False))}::jsonb, {r['year']}, {q(r['jurisdiction'])}, {q(r['source_url'])}, '{V}', '{REV}')" for r in rows)
sql = f"""-- Declaración estatal de no residentes y fechas límite: CO, UT, CA, ID, VT (verificado {V}).
-- Generado por scripts/state-returns.py. WY y NH quedan pendientes (sin fuente oficial clara).
insert into public.tax_rules (key, value, year, jurisdiction, source_url, verified_at, reviewed_by) values
{vals}
on conflict (key, jurisdiction, year) do update set value = excluded.value, source_url = excluded.source_url, verified_at = excluded.verified_at;

-- Montana: resumen bilingüe para la app (mismo contenido de la fuente).
update public.tax_rules set value = value || jsonb_build_object('summary', {q(json.dumps(MT_SUMMARY, ensure_ascii=False))}::jsonb)
where key = 'state_return_nonresident' and jurisdiction = 'MT';
"""
(ROOT / 'supabase/migrations/20261030000930_state_returns.sql').write_text(sql, encoding='utf-8')
print(len(rows))
