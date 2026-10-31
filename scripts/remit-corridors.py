"""
Corredores EE. UU. → país por proveedor (además de Perú, que vive en los campos principales).
Verificado el 2026-10-30 en la página del proveedor para envíos DESDE EE. UU.
Solo se carga lo confirmado; sin comisiones ni tipos de cambio.
Salida: src/data/seed/remitProviders.json y supabase/migrations/20261030000940_remit_corridors.sql
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
V = '2026-10-30'

def c(url, methods, cur, wallets=(), src=None):
    return {'url': url, 'methods': list(methods), 'receive_currencies': list(cur), 'wallets': list(wallets), 'source_urls': [src or url], 'verified_at': V}

R = 'https://www.remitly.com/us/en/'
W = 'https://www.westernunion.com/us/en/send-money-to-'
CORRIDORS = {
    'remitly': {
        'AR': c(R + 'argentina', ['bank', 'cash', 'wallet'], ['ARS']),
        'BO': c(R + 'bolivia', ['bank', 'cash'], ['BOB']),
        'BR': c(R + 'brazil', ['bank', 'cash'], ['BRL']),
        'CL': c(R + 'money-transfer/send-money-to-chile', ['bank', 'cash', 'wallet'], ['CLP']),
        'CO': c(R + 'colombia', ['bank', 'cash', 'wallet'], ['COP'], ['Nequi', 'Daviplata']),
        'EC': c(R + 'ecuador', ['bank', 'cash', 'wallet'], ['USD']),
    },
    'western_union': {
        'AR': c(W + 'argentina.html', ['bank', 'cash', 'wallet'], ['ARS']),
        'BO': c(W + 'bolivia.html', ['bank', 'cash', 'wallet'], ['BOB']),
        'BR': c('https://westernunion.com/us/en/send-money-to-brazil.html', ['bank', 'cash', 'wallet'], ['BRL']),
        'CL': c('https://westernunion.com/us/en/send-money-to-chile.html', ['bank', 'cash'], []),
        'CO': c(W + 'colombia.html', ['bank', 'cash', 'wallet'], ['COP'], ['Nequi', 'Coink', 'PayValida']),
        'EC': c(W + 'ecuador.html', ['bank', 'cash'], ['USD']),
    },
    'xoom': {
        'CO': c('https://xoom.com/colombia', ['bank', 'cash', 'wallet'], ['COP'], ['Nequi', 'AstroPay']),
    },
    'worldremit': {
        'BO': c('https://www.worldremit.com/en-us/bolivia', ['bank', 'cash', 'wallet'], ['BOB']),
        'CL': c('https://www.worldremit.com/en-us/chile', ['bank', 'cash', 'wallet'], ['CLP']),
    },
    'wise': {
        'CL': c('https://wise.com/es-us/send-money/send-money-to-chile', ['bank'], ['CLP']),
    },
}

p = ROOT / 'src/data/seed/remitProviders.json'
d = json.loads(p.read_text(encoding='utf-8'))
for prov in d['providers']:
    cor = CORRIDORS.get(prov['id'], {})
    prov['corridors'] = cor
    prov['countries'] = sorted(set(['PE'] + list(cor)))
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

q = lambda s: "'" + s.replace("'", "''") + "'"
upd = '\n'.join(
    f"update public.remit_providers set corridors = {q(json.dumps(cor, ensure_ascii=False))}::jsonb, countries = {q('{' + ','.join(sorted(set(['PE'] + list(cor)))) + '}')}::text[] where id = {q(pid)};"
    for pid, cor in CORRIDORS.items()
)
sql = f"""-- Corredores EE. UU. → país (AR, BO, BR, CL, CO, EC), verificados {V} en la web de cada proveedor.
-- Generado por scripts/remit-corridors.py. Perú sigue en los campos principales de cada fila.
alter table public.remit_providers add column if not exists corridors jsonb not null default '{{}}' check (jsonb_typeof(corridors) = 'object');
comment on column public.remit_providers.corridors is 'Por país (ISO alfa-2): url, methods, receive_currencies, wallets, source_urls, verified_at.';
{upd}
"""
(ROOT / 'supabase/migrations/20261030000940_remit_corridors.sql').write_text(sql, encoding='utf-8')
print(sql[:300])
