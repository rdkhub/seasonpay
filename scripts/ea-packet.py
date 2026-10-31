"""
Arma el paquete de revisión para el Enrolled Agent (HTML + PDF).
Fuentes: src/data/seed/rules.json (igual a tax_rules en Supabase) y los textos de la app (i18n).
Uso:
  npx vite-node scripts/dump-i18n.ts   -> genera docs/review/i18n.json
  python3 scripts/ea-packet.py          -> docs/review/seasonpay-ea-review.html y .pdf
"""
import html
import json
import pathlib
import datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/review'
rules = json.loads((ROOT / 'src/data/seed/rules.json').read_text(encoding='utf-8'))['rules']
i18n = json.loads((OUT / 'i18n.json').read_text(encoding='utf-8'))
TODAY = datetime.date.today().isoformat()

e = html.escape


def flat(d, prefix=''):
    out = {}
    for k, v in d.items():
        p = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            out.update(flat(v, p))
        else:
            out[p] = v
    return out


def texts(ns, only=None):
    es_f, en_f = flat(i18n['es'][ns], ns), flat(i18n['en'][ns], ns)
    keys = [k for k in en_f if (only is None or any(k.startswith(f'{ns}.{o}') for o in only))]
    return [(k, en_f.get(k, ''), es_f.get(k, '')) for k in keys]


def review_box():
    return '<div class="rv"><span>☐ OK</span><span>☐ Needs change</span><span class="n">Notes:</span></div>'


def rule_card(r):
    v = json.dumps(r['value'], ensure_ascii=False, indent=2)
    return f"""
<div class="card">
  <div class="hd"><b>{e(r['key'])}</b> · {e(r['jurisdiction'])} · {r['year']}</div>
  <pre>{e(v)}</pre>
  <div class="meta">Source: <a href="{e(r['source_url'])}">{e(r['source_url'])}</a><br>
  Verified: {e(r['verified_at'])} · Reviewed by: {e(r.get('reviewed_by') or 'not reviewed')}{('<br>Notes: ' + e(r['notes'])) if r.get('notes') else ''}</div>
  {review_box()}
</div>"""


def text_table(rows):
    body = ''.join(f'<tr><td class="k">{e(k)}</td><td>{e(str(en))}</td><td>{e(str(es))}</td><td class="c">☐</td></tr>' for k, en, es in rows)
    return f'<table class="tx"><thead><tr><th>Key</th><th>English (shown in app)</th><th>Spanish (shown in app)</th><th>OK</th></tr></thead><tbody>{body}</tbody></table>'


fed = sorted([r for r in rules if r['jurisdiction'] == 'federal'], key=lambda r: (r['key'], r['year']))
state_ret = sorted([r for r in rules if r['key'].startswith('state_return')], key=lambda r: (r['jurisdiction'], r['key']))
ot = sorted([r for r in rules if r['key'] == 'overtime_state'], key=lambda r: r['jurisdiction'])
ot_other = sorted([r for r in rules if r['key'].startswith('overtime') and r['key'] != 'overtime_state' and r['jurisdiction'] != 'federal'], key=lambda r: r['key'])
other = [r for r in rules if r not in fed + state_ret + ot + ot_other]


def ot_row(r):
    v = r['value']
    if v.get('no_state_law'):
        rule = 'No state minimum wage law'
    elif v.get('excludes_flsa_covered'):
        rule = 'State law excludes FLSA-covered employment'
    elif v.get('no_state_overtime'):
        rule = 'No state overtime provision'
    else:
        parts = []
        if v.get('weekly_hours'):
            parts.append(f"&gt;{v['weekly_hours']} h/week")
        if v.get('daily_hours'):
            parts.append(f"&gt;{v['daily_hours']} h/day" + (' (all employers)' if v.get('daily_applies_to_all') else ' (conditional)'))
        if v.get('daily_double_time_hours'):
            parts.append(f"2x &gt;{v['daily_double_time_hours']} h/day")
        if v.get('seventh_day'):
            parts.append('7th day')
        if v.get('seasonal_recreation_weekly_hours'):
            parts.append(f"seasonal recreation: &gt;{v['seasonal_recreation_weekly_hours']} h/week")
        rule = ', '.join(parts) + f" · {v.get('multiplier', 1.5)}x"
    notes = ', '.join(v.get('notes') or [])
    return f'<tr><td>{e(r["jurisdiction"])}</td><td>{rule}</td><td class="k">{e(notes)}</td><td class="k"><a href="{e(r["source_url"])}">source</a></td><td class="c">☐</td></tr>'


pending = sum(1 for r in rules if (r.get('reviewed_by') or '').lower().startswith('pendiente') or not r.get('reviewed_by'))

doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SeasonPay · Enrolled Agent review</title>
<style>
@page {{ size: Letter; margin: 16mm 14mm; }}
body {{ font: 10.5pt/1.45 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color:#111; }}
h1 {{ font-size: 20pt; margin: 0 0 4px; }} h2 {{ font-size: 14pt; margin: 22px 0 8px; border-bottom: 2px solid #1a5fd2; padding-bottom: 3px; page-break-after: avoid; }}
h3 {{ font-size: 11.5pt; margin: 14px 0 6px; }}
.sub {{ color:#555; }} .box {{ background:#f3f6fb; border:1px solid #d6e0f0; border-radius:6px; padding:10px 12px; margin:10px 0; }}
.card {{ border:1px solid #ddd; border-radius:6px; padding:8px 10px; margin:8px 0; page-break-inside: avoid; }}
.hd {{ font-size: 10.5pt; margin-bottom: 4px; }}
pre {{ background:#fafafa; border:1px solid #eee; padding:6px 8px; font-size:8.5pt; white-space:pre-wrap; word-break:break-word; margin:4px 0; }}
.meta {{ font-size: 8.5pt; color:#444; word-break: break-all; }}
.rv {{ display:flex; gap:18px; font-size:9pt; margin-top:6px; }} .rv .n {{ flex:1; border-bottom:1px solid #999; }}
table {{ border-collapse: collapse; width:100%; font-size: 8.5pt; }} th, td {{ border:1px solid #ddd; padding:4px 5px; vertical-align: top; text-align:left; }}
th {{ background:#eef2f8; }} tr {{ page-break-inside: avoid; }} .k {{ font-family: Menlo, Consolas, monospace; font-size: 7.5pt; color:#333; word-break: break-all; }} .c {{ text-align:center; width:28px; }}
a {{ color:#1a5fd2; }} ul {{ margin: 4px 0 4px 18px; padding:0; }}
</style></head><body>
<h1>SeasonPay · Rules review for an Enrolled Agent</h1>
<div class="sub">Generated {TODAY} · {len(rules)} rules · {pending} pending review</div>

<div class="box">
<b>What SeasonPay is.</b> A free, offline-first web app (pilot, winter season Dec 2026 to Mar 2027) for seasonal workers in the US on J-1 and H-2B visas. Users log shifts, tips and paystubs; the app estimates pay and overtime, flags possible Social Security/Medicare (FICA) withholding for nonresident J-1 workers, lists filing deadlines and an end-of-season checklist.<br><br>
<b>What it does not do.</b> It does not prepare or file returns, does not compute income tax owed or refunds, and does not apply tax treaties (the pilot group is mostly from Peru, which has no income tax treaty with the US). Every message is phrased as information with a link to the official source and the date it was verified ("According to the IRS…, you may… Confirm with your employer, sponsor or a professional").<br><br>
<b>How rules work.</b> No tax or labor figure is hardcoded. Each rule is a row in <code>tax_rules</code> (key, value, year, jurisdiction, source URL, verified date, reviewer). The app shows the source link and verified date next to every rule.
</div>

<div class="box">
<b>What we ask you to review.</b>
<ul>
<li>Section 1 (federal) and the user-facing texts in Section 5: accuracy and wording. This is the priority.</li>
<li>Section 2 (state returns): whether the summaries are correct for nonresident seasonal workers.</li>
<li>Sections 3 and 4 (overtime): labor-law data from the US Department of Labor table; a quick sanity check is enough.</li>
</ul>
Please tick <b>OK</b> or <b>Needs change</b> and write notes. If you approve a rule, we will set <code>reviewed_by</code> to your name and the date.
</div>

<div class="box">
<b>Known limitations (by design in the pilot).</b>
<ul>
<li>Federal rules use Publication 519 (2025) and the 2025 forms, the latest published as of {TODAY}. They will be re-verified when the 2026 editions are released.</li>
<li>Deadlines: if a date falls on a weekend, the app shows the original date, flags it and explains the next-business-day rule (Pub. 519). It does not compute legal holidays (e.g., DC Emancipation Day).</li>
<li>Overtime: the app applies weekly overtime, daily overtime in AK, CA and CO, CA double time (over 12 h/day and over 8 h on the 7th consecutive day), and the CA and KY seventh-day rules (KY only when the week exceeds 40 h, per KRS 337.050). Each shift counts on the day it starts, so a long overnight shift covers CO's 12 consecutive hours; two back-to-back shifts logged on different days are not merged. NV daily overtime depends on wage and is set by the user.</li>
<li>FICA: exemption logic covers nonresident F/J/M/Q under Pub. 519. It does not handle the student FICA exception under IRC 3121(b)(10).</li>
<li>Alaska: no explicit official page found stating there is no individual income tax; no state rule is shown for AK.</li>
</ul></div>

<h2>1. Federal rules ({len(fed)})</h2>
{''.join(rule_card(r) for r in fed)}

<h2>2. State return rules ({len(state_ret)})</h2>
{''.join(rule_card(r) for r in state_ret)}

<h2>3. State overtime ({len(ot)} jurisdictions)</h2>
<p class="meta">Source for all rows unless noted: US DOL, State Minimum Wage Laws, "Premium Pay After Designated Hours" (updated Jul 1, 2026). Daily overtime confirmed in the state source for AK, CA, CO, NV.</p>
<table><thead><tr><th>State</th><th>Rule loaded</th><th>Notes shown</th><th>Source</th><th>OK</th></tr></thead><tbody>
{''.join(ot_row(r) for r in ot)}
</tbody></table>

<h2>4. Other state-specific rules ({len(ot_other) + len(other)})</h2>
{''.join(rule_card(r) for r in ot_other + other)}

<h2>5. Texts the user sees</h2>
<h3>Social Security and Medicare (FICA)</h3>
{text_table(texts('fica'))}
<h3>End-of-season checklist</h3>
{text_table(texts('checklist'))}
<h3>Deadlines</h3>
{text_table(texts('deadlines'))}
<h3>Disclaimers</h3>
{text_table(texts('tax'))}
<h3>Overtime notices</h3>
{text_table(texts('employer', ['overtimeNotice', 'stateStudentNotice']) + texts('stateOt'))}

<p class="meta" style="margin-top:20px">Contact: through the app (Settings → Send feedback) or directly with the project owner. Thank you for your time.</p>
</body></html>"""

OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'seasonpay-ea-review.html').write_text(doc, encoding='utf-8')

from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto((OUT / 'seasonpay-ea-review.html').as_uri())
    pg.pdf(path=str(OUT / 'seasonpay-ea-review.pdf'), format='Letter', print_background=True,
           display_header_footer=True, header_template='<span></span>',
           footer_template='<div style="font-size:8px;width:100%;text-align:center;color:#777">SeasonPay · EA review · <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
           margin={'top': '14mm', 'bottom': '16mm', 'left': '12mm', 'right': '12mm'})
    b.close()
print('ok', len(rules))
