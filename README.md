# SeasonPay

PWA para trabajadores de temporada (J-1, H-2B): turnos, propinas y pago bruto estimado, funcionando sin señal.
Fase 1: bienvenida, Hoy, Semana y Ajustes. Todo vive en el celular (IndexedDB); la sincronización con Supabase está lista pero apagada hasta la Fase 4.

## Correrlo

Necesitas Node 20 o superior.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de dominio (Vitest)
npm run lint
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve dist/ con el service worker activo
```

Para verlo en el celular en tu red: `npm run dev -- --host` y abre la IP que muestra. Ojo: por http en una IP el navegador no registra el service worker, así que la instalación como app y el modo sin internet se prueban en el deploy de Vercel (https) o con `npm run preview` en localhost.

## Estructura

```
src/
  app/            router, providers, layout y barra inferior
  features/
    onboarding/   bienvenida en 3 pasos
    shifts/       pantalla Hoy, cronómetro, formulario de turno, propinas
    week/         pantalla Semana y el hook que arma el resumen
    settings/     idioma, perfil, empleadores, fuentes, borrar datos
  shared/
    ui/           sistema de diseño (Button, Card, Input, MoneyDisplay, Sheet, Toggle, EmptyState…)
    lib/          formatos, dinero, hooks chicos
    i18n/         react-i18next, es y en
  data/
    db.ts         esquema Dexie (fuente de verdad local)
    repos/        lecturas y escrituras; cada escritura entra a la cola de sync
    sync/         cliente Supabase (carga diferida), mapeo y motor de sync
    seed/         rules.json: copia local de tax_rules
  domain/         cálculos puros (horas, medianoche, descansos, overtime, pago) + tests
supabase/
  migrations/     esquema, RLS, índices, tax_rules y reglas iniciales
  functions/      delete-account (para "Borrar todos mis datos" con sesión)
```

Reglas de la arquitectura:

- `src/domain` no importa React, Dexie ni nada de `src/data` o `src/features` (ESLint lo bloquea).
- Las pantallas leen con `useLiveQuery` (en `src/data/hooks.ts`) y escriben solo por los repositorios.
- Dinero siempre en centavos (enteros). Tiempos en epoch ms.

## Cómo se calcula el overtime

- Por empleador y por semana laboral de ese empleador (día de inicio configurable). Las horas con un empleador no suman al umbral de otro.
- No se promedian semanas. Un turno que cruza el inicio de la semana laboral se parte entre las dos.
- El umbral y el multiplicador **no están en el código**: salen de `tax_rules` (`overtime_weekly`, fuente DOL) y se copian al crear cada empleador. El usuario puede apagarlo o ajustarlo por empleador, porque algunos negocios de temporada pueden estar exentos (aviso `overtime_seasonal_exemption_notice`, DOL Fact Sheet #18).
- Montana (MCA 39-3-405) usa el mismo umbral de 40 h y 1.5x. Para estudiantes en áreas recreativas de temporada con alojamiento o comida del empleador, la ley sube el umbral a 48 h: la app lo muestra como aviso en el empleador y deja aplicarlo con un toque, pero no lo decide sola.
- El pago es un estimado bruto: tarifa base como "regular rate", sin impuestos ni deducciones.

## Boletas y FICA (Fase 2)

- Cada boleta guarda horas, bruto, propinas, retenciones y neto. Nunca SSN ni datos bancarios.
- `src/domain/paystubs.ts` compara la boleta con los turnos del periodo (horas, overtime, sueldo sin propinas y propinas con tarjeta) y marca diferencias con una tolerancia de 15 min y $1.
- `src/domain/fica.ts` evalúa, solo como información, si Social Security y Medicare podrían no aplicar (J-1 no residente). Los límites de años y el flujo de reembolso (empleador primero, luego Form 843 con sus adjuntos) salen de `tax_rules`, fuente IRS Publication 519 (2025).

## Ahorro, checklist y exportación (Fase 3)

- Ahorro en dólares con su equivalente en soles. Cada movimiento guarda el tipo de cambio del BCRP de ese día (serie `PD04638PD`, TC interbancario venta, tomada de `tax_rules`); nunca se recalcula. Sin señal, el movimiento se guarda y el tipo de cambio se completa al volver internet. También se puede escribir a mano.
- El API del BCRP no permite llamadas desde el navegador, así que pasa por `api/fx.js` (Vercel Function).
- Checklist de fin de temporada guardado en el perfil, con enlaces a las fuentes del IRS (Form 8843, 1040-NR, reembolso de FICA).
- Exporta un PDF con el resumen (jsPDF, se carga solo al usarlo) y tres CSV (turnos, boletas, ahorro). En el celular se abre el menú de compartir.

## Reglas oficiales (tax_rules)

Cada regla tiene `key`, `value` (jsonb), `year`, `jurisdiction` (`federal` o código de estado), `source_url`, `verified_at` y `reviewed_by`.
Para agregar o cambiar una regla:

1. Verifica el dato en la fuente primaria (ver `fuentes-oficiales.md` del proyecto).
2. Agrégala en una migración nueva en `supabase/migrations/` (con `on conflict … do update`).
3. Copia el mismo registro en `src/data/seed/rules.json` para que funcione sin internet.

Para la revisión del Enrolled Agent: `select * from tax_rules_review;` muestra primero lo pendiente.

## Variables de entorno

Copia `.env.example` a `.env.local`. En la Fase 1 no hace falta ninguna.

| Variable | Para qué | Fase |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | 4 |
| `VITE_SUPABASE_ANON_KEY` | Llave pública (anon) | 4 |
| `VITE_SYNC_ENABLED` | `true` para activar la sincronización | 4 |

Nunca pongas la `service_role` key en variables `VITE_`: terminan en el navegador.

## Supabase

Proyecto: `seasonpay` (ref `qjmtgrxyjtomirzhdvdq`, región us-west-1). Las cuatro migraciones y la Edge Function `delete-account` ya están aplicadas.
Para replicarlo en otro proyecto:

```bash
npm i -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push                              # aplica supabase/migrations
supabase functions deploy delete-account      # cuando llegue el login (Fase 4)
```

También puedes pegar las migraciones en orden en el SQL Editor del panel.

## Desplegar en Vercel

1. Sube el proyecto a GitHub.
2. En Vercel: Add New → Project → importa el repo. Detecta Vite solo (`vercel.json` ya trae build, carpeta `dist` y las reglas para el router y el service worker).
3. (Fase 4) Agrega las variables de entorno en Settings → Environment Variables.
4. Deploy. Cada push a `main` vuelve a desplegar.

## Instalar la PWA en el celular

- **Android (Chrome):** abre la URL de Vercel → menú ⋮ → "Instalar app" o "Agregar a pantalla principal".
- **iPhone (Safari):** abre la URL → botón Compartir → "Agregar a inicio". Tiene que ser Safari.

Después de abrirla una vez con internet, funciona sin señal.

## Íconos

Los PNG de `public/` (íconos y splash de iPhone) salen de `public/favicon.svg` y `scripts/icon-full.svg` (versión a sangre para maskable y Apple).
