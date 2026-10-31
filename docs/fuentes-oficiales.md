# SeasonPay: fuentes oficiales y contexto de datos

Documento de contexto del proyecto. Lista las únicas fuentes válidas para cualquier dato tributario, laboral o de tipo de cambio que use la app.
Última actualización de esta lista: 2026-10-30 (corredores LATAM, Rextie y tipo de cambio SUNAT).

## Reglas de uso de estas fuentes

1. Solo se usan fuentes primarias (gobierno de EE. UU., gobiernos estatales, BCRP). Las secundarias sirven para contrastar, nunca como fuente final.
2. Cada dato que entre a la tabla `tax_rules` lleva: url_fuente, año, jurisdicción, fecha_verificacion y revisado_por.
3. Si una cifra, fecha o regla no se puede confirmar en estas fuentes, no se usa. Se marca como pendiente y se avisa.
4. La app informa y enlaza la fuente; no da asesoría tributaria.
5. Antes de usar una URL de esta lista, verificar que siga vigente: las páginas del gobierno cambian de dirección.

---

## 1. Federal: residencia fiscal y estatus de no residente

| Tema | Fuente | URL |
| --- | --- | --- |
| Guía tributaria para extranjeros (la base de todo) | IRS Publication 519 | https://www.irs.gov/publications/p519 |
| Tributación de no residentes | IRS | https://www.irs.gov/individuals/international-taxpayers/taxation-of-nonresident-aliens |
| Cómo se determina la residencia fiscal | IRS | https://www.irs.gov/individuals/international-taxpayers/determining-an-individuals-tax-residency-status |
| Prueba de presencia sustancial | IRS | https://www.irs.gov/individuals/international-taxpayers/substantial-presence-test |
| Tratados tributarios (Perú no tiene tratado con EE. UU.) | IRS Publication 901 | https://www.irs.gov/publications/p901 |

Datos clave a extraer y validar: años en que un J-1 cuenta como "exempt individual", diferencia entre J-1 estudiante y J-1 de otras categorías, y cuándo deja de ser no residente.

## 2. Federal: retenciones sobre el sueldo

| Tema | Fuente | URL |
| --- | --- | --- |
| Retención a no residentes | IRS Publication 515 | https://www.irs.gov/publications/p515 |
| Tablas de retención federal (sale cada diciembre) | IRS Publication 15-T | https://www.irs.gov/publications/p15t |
| Cómo llena el W-4 un no residente | IRS Notice 1392 | https://www.irs.gov/pub/irs-pdf/n1392.pdf |
| Formulario W-4 | IRS | https://www.irs.gov/forms-pubs/about-form-w-4 |

## 3. Federal: Social Security y Medicare (FICA)

| Tema | Fuente | URL |
| --- | --- | --- |
| Exención de FICA para estudiantes y J-1 | IRS | https://www.irs.gov/individuals/international-taxpayers/foreign-student-liability-for-social-security-and-medicare-taxes |
| Reclamo de reembolso | IRS Form 843 | https://www.irs.gov/forms-pubs/about-form-843 |
| Reembolso de Social Security retenido por error (visas F, J, M) | IRS Form 8316 | https://www.irs.gov/forms-pubs/about-form-8316 |
| Tasas y tope salarial de Social Security (se anuncia cada octubre) | Social Security Administration | https://www.ssa.gov/oact/cola/cbb.html |

Flujo oficial de reembolso a reflejar en la app: primero se pide al empleador; solo si no devuelve todo, se presenta el Form 843 al IRS con copia del W-2, I-94 y DS-2019, más el Form 8316 o una carta del empleador.

## 4. Federal: declaración anual

| Tema | Fuente | URL |
| --- | --- | --- |
| Declaración obligatoria para J-1 (aunque no tenga ingresos) | IRS Form 8843 | https://www.irs.gov/forms-pubs/about-form-8843 |
| Declaración de impuestos de no residentes | IRS Form 1040-NR | https://www.irs.gov/forms-pubs/about-form-1040-nr |
| Fecha límite del 1040-NR (`form_1040nr_due_date`): empleados con sueldo sujeto a retención, el 15 del 4.º mes después del año (15 de abril); el resto, el 15 del 6.º mes (15 de junio). Verificado 2026-10-17 | IRS, Taxation of Nonresident Aliens | https://www.irs.gov/individuals/international-taxpayers/taxation-of-nonresident-aliens |

Una temporada de invierno cruza dos años tributarios (ej. dic-2026 a mar-2027): cada año se declara por separado y la app muestra las dos fechas. La regla de fin de semana o feriado no se verificó; la app pide confirmar la fecha en la fuente.

## 5. Propinas

| Tema | Fuente | URL |
| --- | --- | --- |
| Cómo se reportan las propinas | IRS Publication 531 | https://www.irs.gov/publications/p531 |
| Reporte de propinas al empleador | IRS Form 4070 | https://www.irs.gov/forms-pubs/about-form-4070 |
| Empleados con propinas bajo la ley laboral | U.S. Department of Labor, Fact Sheet #15 | https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa |

## 6. Leyes laborales: overtime y salario mínimo

| Tema | Fuente | URL |
| --- | --- | --- |
| Overtime federal (más de 40 h por semana) | U.S. Department of Labor | https://www.dol.gov/agencies/whd/overtime |
| Exención federal para negocios recreativos de temporada (FLSA 13(a)(3)) | U.S. Department of Labor, Fact Sheet #18 | https://www.dol.gov/agencies/whd/fact-sheets/18-flsa-seasonal-amusement |
| Overtime de Montana (40 h, 1.5x; 48 h para estudiantes en áreas recreativas de temporada con alojamiento o comida del empleador) | MCA 39-3-405 | https://mca.legmt.gov/bills/mca/title_0390/chapter_0030/part_0040/section_0050/0390-0030-0040-0050.html |
| Salario mínimo y overtime por estado (sección "Premium Pay After Designated Hours", actualizada 1-jul-2026) | U.S. Department of Labor | https://www.dol.gov/agencies/whd/minimum-wage/state |
| Leyes laborales de Montana | Montana Department of Labor & Industry | https://dli.mt.gov |

Cargado en `tax_rules` el 2026-10-17 (pendiente de revisión del Enrolled Agent): `overtime_weekly` federal y MT, `overtime_seasonal_exemption_notice` federal, `overtime_seasonal_student_notice` MT.

Cargado el 2026-10-30 (pendiente Enrolled Agent): `overtime_state` para los 50 estados y DC, según la tabla del DOL. Los estados con overtime diario se confirmaron además en la fuente estatal:

| Estado | Regla | Fuente | URL |
| --- | --- | --- | --- |
| Alaska | 8 h/día y 40 h/semana; no aplica a empleadores con 3 trabajadores o menos | Alaska Dept. of Labor, Summary of the Wage and Hour Act (rev. 01-2025) | https://labor.alaska.gov/lss/forms/Summary_of_Alaska_Wage_and_Hour_Act__Rev_01-25.pdf |
| California | 8 h/día a 1.5x, más de 12 h a 2x, 7.º día seguido, 40 h/semana (Labor Code 510) | DIR / DLSE | https://www.dir.ca.gov/dlse/faq_overtime.htm |
| Colorado | 40 h/semana, 12 h/día o 12 h seguidas, la que pague más (COMPS Order #39) | CDLE | https://cdle.colorado.gov/sites/cdle/files/INFO%20%231%20COMPS%20Order%20%2339%20(2024)%2012.8.23%20%5Baccessible%5D.pdf |
| Nevada | 8 h/día solo si gana menos de 1.5 veces el salario mínimo; 40 h/semana (NRS 608.018) | Nevada Legislature | https://www.leg.state.nv.us/nrs/nrs-608.html |

La app aplica el overtime diario automáticamente en AK (8 h), CA (8 h) y CO (12 h). En NV queda manual porque depende del salario. Todavía no calcula el doble tiempo ni el 7.º día de CA, el 7.º día de KY ni las 12 horas seguidas de CO; lo avisa en la tarjeta del estado. La FLSA (40 h) sigue como base para empleadores cubiertos.

## 7. Impuestos estatales

| Estado | Fuente | URL |
| --- | --- | --- |
| Montana (piloto) | Montana Department of Revenue | https://mtrevenue.gov |
| Colorado | Colorado Department of Revenue | https://tax.colorado.gov |
| Utah | Utah State Tax Commission | https://tax.utah.gov |
| Idaho | Idaho State Tax Commission | https://tax.idaho.gov |
| Vermont | Vermont Department of Taxes | https://tax.vermont.gov |
| California | Franchise Tax Board | https://www.ftb.ca.gov |

Estados sin impuesto estatal a los sueldos (verificar cada año): Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington y Wyoming.

Fuente secundaria solo para contrastar tasas estatales: Tax Foundation, https://taxfoundation.org

Cargado en `tax_rules` (verificado 2026-10-17, pendiente Enrolled Agent):

| Regla | Fuente | URL |
| --- | --- | --- |
| `state_return_nonresident` MT: no residentes con ingresos de fuente de Montana y obligación de declarar a nivel federal declaran en Montana; excepción si solo ganaron sueldo por 30 días o menos y trabajaron en más de un estado | Montana DOR, Filing Requirements | https://revenue.mt.gov/taxes/individual-income-tax/filing-requirements |
| `state_return_due_date` MT: 15 de abril (extensión 15 de octubre) | Montana DOR | https://revenue.mt.gov/taxes/individual-income-tax |

El 2026-10-30 se cargó la declaración estatal de no residentes de CO, UT, CA, ID y VT (migración `20261030000930_state_returns.sql`). Pendiente: Wyoming y New Hampshire (sin impuesto a sueldos, falta confirmarlo en su fuente) y la fecha límite de Utah.

## 8. Programa J-1

| Tema | Fuente | URL |
| --- | --- | --- |
| Programa BridgeUSA (J-1) | U.S. Department of State | https://j1visa.state.gov |
| Summer Work Travel | U.S. Department of State | https://j1visa.state.gov/programs/summer-work-travel |
| Reglamento de Summer Work Travel (22 CFR 62.32) | eCFR | https://www.ecfr.gov/current/title-22/chapter-I/subchapter-H/part-62/subpart-B/section-62.32 |

También sirven las guías de impuestos que publican los sponsors J-1 para sus participantes, como referencia de lenguaje y casos comunes, no como fuente de cifras.

## 9. Tipo de cambio (USD a PEN)

| Tema | Fuente | URL |
| --- | --- | --- |
| Estadísticas del BCRP | Banco Central de Reserva del Perú | https://estadisticas.bcrp.gob.pe |
| API de series del BCRP | BCRP | https://estadisticas.bcrp.gob.pe/estadisticas/series/ayuda/api |
| Tipo de cambio publicado (respaldo) | SUNAT | https://www.sunat.gob.pe/a/txt/tipoCambio.txt |

Desde oct-2026 la API del BCRP responde con una página anti-bot a los pedidos automáticos. La app intenta primero el BCRP; si falla, usa el tipo de cambio de venta de SUNAT, lo guarda dos veces al día en `fx_daily` y lo marca como "SUNAT" en el ahorro. No se intenta saltar el bloqueo del BCRP.

Usar el tipo de cambio interbancario de venta. Guardar el tipo de cambio usado en cada registro de ahorro, no recalcular con el del día.

## 10. Proveedores para enviar plata de EE. UU. a casa

Tabla `remit_providers` (no es `tax_rules`: no la revisa el Enrolled Agent). Solo se guardan datos de la página oficial de cada proveedor: tipo (remesadora o casa de cambio), países, métodos de entrega, moneda de llegada y billeteras. Comisiones y tipos de cambio nunca se guardan; el usuario los ve en la calculadora del proveedor. Orden alfabético en la app. Los links de referido solo se muestran si `app_config.referrals_enabled` está prendido y el proveedor tiene `referral_enabled` y `referral_url`; ahí se marcan como "Enlace de referido".

| Proveedor | Fuente oficial | Verificado |
| --- | --- | --- |
| MoneyGram | https://www.moneygram.com/r/pe/en y https://developer.moneygram.com/moneygram-developer/docs/direct-send-options-for-pe | 2026-10-17 |
| Remitly | https://www.remitly.com/us/en/money-transfer/send-money-to-peru y https://www.remitly.com/us/en/peru/pricing | 2026-10-17 |
| Western Union | https://www.westernunion.com/us/en/send-money-to-peru.html | 2026-10-17 |
| Wise | https://wise.com/us/send-money/send-money-to-peru | 2026-10-17 |
| WorldRemit | https://www.worldremit.com/en-us/peru | 2026-10-17 |
| Xoom | https://www.xoom.com/peru | 2026-10-17 |
| Kambista (casa de cambio, Perú) | https://kambista.com (indica registro SBS-UIF 00335-2017) | 2026-10-17 |
| Rextie (casa de cambio, Perú) | https://www.rextie.com/terminos-y-condiciones/ (indica registro como casa de cambio digital, Res. SBS N° 684-2017) | 2026-10-30 |
| TKambio (casa de cambio, Perú) | https://tkambio.com (indica inscripción SBS, Res. 03054-2017) | 2026-10-17 |

Corredores a otros países de LATAM (`remit_providers.corridors`, generado por `scripts/remit-corridors.py`), verificados 2026-10-30 en la página de cada proveedor para envíos desde EE. UU.:

| Proveedor | Países | Notas |
| --- | --- | --- |
| Remitly | AR, BO, BR, CL, CO, EC | Moneda de llegada confirmada en los seis |
| Western Union | AR, BO, BR, CL, CO, EC | Chile sin moneda confirmada |
| Wise | BO, BR, CL, CO, EC | Solo a cuenta bancaria. No ofrece pesos argentinos (lista de espera) |
| Xoom | AR, BO, BR, CL, CO, EC | Moneda confirmada solo en CO |
| WorldRemit | AR, BO, BR, CL, CO, EC | Moneda confirmada solo en BO y CL |
| MoneyGram | solo PE por ahora | Falta verificar otros países |

Stripe no abre cuentas de negocio desde Perú (verificado 2026-10-17). Opciones para el pase de temporada cuando se active: Lemon Squeezy (paga a banco en Perú) y Polar (paga a Perú vía Stripe Connect Express). Ambos son merchant of record.

## 11. Profesionales y servicios de apoyo

| Tema | Fuente | URL |
| --- | --- | --- |
| Directorio oficial de preparadores con credenciales (Enrolled Agents, CPAs) | IRS | https://irs.treasury.gov/rpo/rpo.jsf |
| Declaraciones para no residentes (posible derivación desde la app) | Sprintax | https://www.sprintax.com |

Plan de validación: un Enrolled Agent que trabaje con declaraciones 1040-NR revisa la tabla `tax_rules` (vista `tax_rules_review`) y los textos de las alertas antes del lanzamiento, y luego una vez al año antes de cada temporada.

---

## Calendario de actualización

| Mes | Qué revisar |
| --- | --- |
| Julio | Tabla de overtime por estado del DOL (se actualiza a mitad de año) y regenerar `overtime_state` |
| Octubre | Tope salarial de Social Security del año siguiente (SSA) |
| Diciembre | Publication 15-T y Publication 515 del año siguiente |
| Enero | Tablas de retención estatales y salarios mínimos que cambian el 1 de enero |
| Antes de cada temporada (abril y noviembre) | Revisión completa de `tax_rules`, URLs vigentes, textos de alertas y páginas de los proveedores de `remit_providers` (incluidos los corredores) |
| Febrero a abril | Fechas límite de Form 8843 y 1040-NR del año en curso |

## Estructura sugerida de un registro en tax_rules

```json
{
  "key": "fica_exemption_j1_student_years",
  "value": { "years": 5, "applies_to": ["J-1 student"] },
  "year": 2026,
  "jurisdiction": "federal",
  "source_url": "https://www.irs.gov/publications/p519",
  "verified_at": "2026-10-17",
  "reviewed_by": "pendiente Enrolled Agent"
}
```

El valor de ejemplo es ilustrativo. Antes de cargarlo en producción, confirmarlo en la Publication 519 vigente.
