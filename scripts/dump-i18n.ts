// Vuelca los textos de la app a docs/review/i18n.json (lo usa scripts/ea-packet.py).
import { writeFileSync } from 'node:fs';
import es from '../src/shared/i18n/locales/es';
import en from '../src/shared/i18n/locales/en';
writeFileSync(new URL('../docs/review/i18n.json', import.meta.url), JSON.stringify({ es, en }, null, 1));
