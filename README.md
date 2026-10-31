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

## Cuenta, sincronización y landing (Fase 4)

- **Login sin contraseña:** el usuario pone su correo y recibe un correo de Supabase. Entra escribiendo el código o tocando el enlace desde el mismo celular. Google es opcional (`VITE_GOOGLE_AUTH=true` cuando el proveedor esté configurado).
- **La cuenta es opcional:** sin login todo sigue funcionando local. Con login se respalda en Supabase y se puede usar en otro celular.
- **Sincronización:** cada cambio va a una cola local (outbox) en la misma transacción. Se envía al volver la señal, al abrir la app, cada 60 s y 2,5 s después de cada cambio. Gana el cambio más reciente (`updated_at`, lo hace cumplir un trigger en Postgres). Los borrados viajan como `deleted_at`.
- **Cerrar sesión** borra los datos personales del celular, pero solo si no quedan cambios sin subir. Si no hay señal, avisa y no borra.
- **Landing bilingüe** en `/hola`: qué es, privacidad e instrucciones para instalar en Android y iPhone. Desde Ajustes → "Invitar a mis compañeros" se comparte ese link.
- **Correos:** el SMTP por defecto de Supabase solo entrega a miembros del equipo del proyecto y tiene un límite bajo por hora. Para el piloto con compañeros hay que configurar un SMTP propio (por ejemplo Resend) en Authentication → Emails → SMTP. Recién ahí se puede editar la plantilla "Magic link or OTP" para mostrar el código con `{{ .Token }}`.
- **URLs de Auth (ya configuradas):** Site URL `https://seasonpay.vercel.app`; redirecciones `https://seasonpay.vercel.app/**` y `http://localhost:5173/**`.

## Enviar plata a Perú (Fase 5)

La app sigue gratis. En vez de pagos, la fase 5 agrega Temporada → "Enviar plata a Perú" (`/season/send`).

- **Proveedores neutrales:** MoneyGram, Remitly, Western Union, Wise y Xoom, en orden alfabético. Solo datos de su página oficial (depósito a banco, efectivo, billetera, moneda de llegada), con link a la fuente y la fecha de verificación. No hay comisiones ni tipos de cambio en el código.
- **Datos en `remit_providers`** (migraciones 0700 y 0710; copia local en `src/data/seed/remitProviders.json`). Lectura pública, escritura solo con service_role. La app los baja con la sincronización, igual que `tax_rules`.
- **Comparador:** el usuario copia de cada app cuánto paga en total y cuánto llega. `compareQuotes` (`src/domain/remit.ts`) ordena por lo que llega por cada dólar y calcula la pérdida frente al interbancario BCRP del día. Las cotizaciones se guardan solo en el celular (tabla Dexie `remitQuotes`, no se sincronizan) y se borran al cerrar sesión o al borrar los datos.
- **Links de referido:** columna `referral_url` (vacía por ahora). Si se llena, la tarjeta muestra "Link de referido", el link lleva `rel="sponsored"` y aparece el aviso de que eso no cambia el orden. Para ponerlo: `update public.remit_providers set referral_url = 'https://…' where id = 'wise';` desde el SQL Editor.
- **Agregar o actualizar un proveedor:** verificar en su web oficial, editar la fila (con `verified_at` del día) y el JSON local con los mismos datos.

## Pre-temporada (piloto 18-dic-2026 a 30-mar-2027)

- **Modo piloto:** "Beta gratuita" y versión en Ajustes. No hay cobros.
- **Instalación:** guía paso a paso (iPhone desde Safari, con la nota de iOS 16.4+ para notificaciones; botón en Android). Tarjeta en Hoy que no aparece si la app ya está instalada.
- **Feedback:** botón en Hoy y en Ajustes. Estrellas, "qué falló", "qué te gustaría" y captura opcional de la pantalla de la app (html-to-image; nunca de la galería, para no recibir boletas reales con SSN). Se adjuntan versión, sistema y pantalla. Sin señal queda en cola (`db.pending`).
- **Consentimiento:** casilla obligatoria en la bienvenida y al crear cuenta. Si cambia `app_config.privacy_policy_version`, la app pide aceptar de nuevo.
- **Política de privacidad:** `/privacidad` (`/privacy`), pública y bilingüe.
- **Exportar y borrar:** Ajustes → Exportar mis datos (JSON). "Borrar mi cuenta" borra local, la cuenta (Edge Function `delete-account`) y, por `install_id`, el feedback, encuestas, métricas y notificaciones de ese celular (`delete_install_data`).
- **Avisos de impuestos:** `TaxDisclaimer` en Boletas, FICA, Fuentes y Temporada. Cada regla muestra fuente y fecha.
- **Fechas límite y recordatorios:** el 1040-NR y la declaración estatal se calculan con `tax_rules` (`form_1040nr_due_date`, `state_return_due_date`), por cada año tributario con turnos. Web Push: la Edge Function `send-reminders` corre todos los días a las 16:00 UTC (pg_cron) y avisa 30, 7 y 1 día antes. Las llaves VAPID las crea la función y la privada vive en Vault.
- **Encuesta de fin de temporada:** tabla `survey_responses`.
- **Enviar plata:** país de destino, consejos, remesadoras y casas de cambio (Perú), interruptor `app_config.referrals_enabled` (apagado) y `referral_enabled` por proveedor. Tabla `provider_rates` lista para tasas en vivo (vacía).
- **Métricas sin datos personales:** tabla `events` con un `install_id` aleatorio, sin correo ni montos. Se puede apagar en Ajustes. Vistas: `metrics_registered`, `metrics_retention`, `metrics_payment_errors`, `metrics_feature_usage`, `metrics_weekly_active`.
- **Admin:** `/admin` (Ajustes → Administración). Solo lo ve quien está en `public.admins`:
  ```sql
  insert into public.admins (user_id) select id from auth.users where email = 'TU_CORREO';
  ```
- **WhatsApp de testers:** `update public.app_config set value = '"https://chat.whatsapp.com/..."' where key = 'whatsapp_group_url';`

## Overtime por estado

- Regla `overtime_state` para los 50 estados y DC (`scripts/state-overtime.py`, migración `20261030000900`). Fuente: DOL "State Minimum Wage Laws", sección Premium Pay (actualizada 1-jul-2026). Overtime diario confirmado en la fuente estatal: Alaska, California, Colorado y Nevada.
- Overtime diario automático en AK (8 h), CA (8 h) y CO (12 h). Nevada (8 h) depende del salario, así que no se aplica solo. Las horas extra diarias no cuentan para las 40 semanales.
- La app muestra la tarjeta "Overtime en tu estado" en Semana y en el empleador, con fuente y fecha. La regla federal (40 h) se mantiene como base.
- No se calcula todavía: el doble tiempo de California (más de 12 h y 7.º día), el 7.º día de Kentucky ni las 12 horas seguidas de Colorado. La app lo avisa.

## Tipo de cambio (BCRP con respaldo SUNAT)

- Desde oct-2026 el API del BCRP responde a consultas automáticas con una página anti-bots. No se intenta saltar esa protección.
- `/api/fx` prueba primero el BCRP. Si no responde, usa el archivo público de SUNAT (`fecha|compra|venta`, solo el día actual).
- La Edge Function `fx-snapshot` guarda cada día (15:00 y 21:00 UTC) el valor de SUNAT en `public.fx_daily`, de lectura pública. Si `/api/fx` falla, la app lee de ahí el último valor de hasta 6 días antes. Así se completan los ahorros guardados sin señal.
- Cada movimiento guarda su fuente (`bcrp`, `sunat` o `manual`) y la app muestra "SUNAT" cuando corresponde. La regla `fx_usd_pen_fallback` (PE) documenta la fuente de respaldo.

## Declaración estatal

`state_return_nonresident` y `state_return_due_date` para MT, CO, UT, CA, ID y VT (`scripts/state-returns.py`, migración `20261030000930`). El checklist muestra el resumen bilingüe de cada estado con su fuente, y la tarjeta de fechas límite muestra la estatal cuando hay fecha verificada (Utah todavía no la tiene).

## Calidad

- `npm test`: dominio (overtime diario, FICA, referidos, fechas límite, envíos) y RLS de `feedback` sobre la migración real con PGlite (`supabase/tests`).
- Lighthouse 12 (móvil, 30-oct-2026) en `/hola` y `/privacidad`: rendimiento 90, accesibilidad 100, buenas prácticas 96, SEO 100. Lighthouse 12 ya no tiene la categoría PWA; la instalación se revisó a mano (manifest con íconos 192/512 y maskable, service worker con caché offline y push).

## Pendientes

- Darte de alta como admin con el SQL de arriba (después de entrar una vez con tu correo).
- SMTP propio (por ejemplo Resend) para que el código de acceso les llegue a otros correos, y luego la plantilla con `{{ .Token }}`.
- Revisión del Enrolled Agent de `tax_rules` (todas marcadas "pendiente Enrolled Agent").
- Declaración estatal: faltan WY y NH (no encontré una página oficial que diga claramente que no cobran impuesto al sueldo) y la fecha límite de Utah.
- Tipo de cambio: si el BCRP vuelve a responder, se usa solo; si no, queda SUNAT. Revisar si conviene pedir al BCRP acceso para la app.
- Calcular el doble tiempo de California y el 7.º día (CA, KY).
- Enviar plata: Perú completo (comparador y casas de cambio). Argentina, Bolivia, Brasil, Chile, Colombia y Ecuador con los corredores confirmados (`remit_providers.corridors`, `scripts/remit-corridors.py`). Wise, Xoom y WorldRemit ya cubren los seis países (Wise no ofrece pesos argentinos; está en lista de espera). Rextie: registro SBS confirmado en sus Términos y Condiciones (Res. SBS N° 684-2017). Falta MoneyGram fuera de Perú y la moneda de llegada de Xoom y WorldRemit en AR, BO, BR, CL, EC.
- Google OAuth (necesita client ID y secret).
- Fase de pagos (pase de temporada): después del piloto, con Lemon Squeezy o Polar.

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
3. Las variables públicas de producción ya vienen en `.env.production` (URL y llave publicable de Supabase, no son secretas).
4. Deploy. Cada push a `main` vuelve a desplegar.

## Instalar la PWA en el celular

- **Android (Chrome):** abre la URL de Vercel → menú ⋮ → "Instalar app" o "Agregar a pantalla principal".
- **iPhone (Safari):** abre la URL → botón Compartir → "Agregar a inicio". Tiene que ser Safari.

Después de abrirla una vez con internet, funciona sin señal.

## Íconos

Los PNG de `public/` (íconos y splash de iPhone) salen de `public/favicon.svg` y `scripts/icon-full.svg` (versión a sangre para maskable y Apple).
