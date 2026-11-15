# Integración de descenso en auditoría y Mission Control

Trabajo local del frente REPORT/M2. Sin cambios de backend, datos científicos, modelos NASA ni archivos de diseño Excel anteriores. No se ejecutaron git add/commit/push ni publicaciones.

## Comportamiento entregado

- `createAuditPanel.landing(payload)` y el recorder validan schema/version, sesión, escenario, cuerpo, DEM, perfil y coherencia de la selección. Rechazan valores no finitos, masa/combustible/empuje incompatibles, contacto sin chequeos/AGL cero y capturas obsoletas; los rechazos conservan la captura previa.
- Las copias se acotan a 1200 muestras / 300 eventos. Nuevo inicio, reinicio y cambio dejan `landing:null`. Snapshot, dossier JSON/misión y contexto conservan una sola identidad de vuelo; el laboratorio manual permanece separado.
- El Markdown incorpora perfiles, candidatos, estado/resultados y límites; el copiloto local explica vuelo/combustible/contacto con rutas grounded y faltantes, sin autorización operativa.
- Excel conserva 12 hojas legacy y añade 3 cuando hay captura: Descenso, Trayectoria, Zona_ensayo. Portada con fase; estilos, filtros A6, congelado A7 y referencias A25:C26 del gráfico anterior conservados. Georreferencias y g0 del Isp tienen seis decimales visibles, sin atribuir precisión instrumental a esos decimales.
- La nave seca de 850 kg incluye rover de 350 kg y nave adicional de 500 kg. Combustible y empuje difieren por cuerpo; no se compara solamente el cambio de gravedad. Cada DEM conserva contacto, pose y georreferencia propios.

## Ensayos reproducibles del motor y datos versionados

Son ejecuciones del motor real con los ocho DEM actuales, no vuelos ni ensayos físicos. El generador usa reloj de evidencia controlado y muestreo 2 Hz SIM; no inventa telemetría de rover. Las fechas de ese reloj no son UTC de una observación real.

| Escenario / caso | Tierra | Objetivo | SIM objetivo (s) | Propelente final objetivo (kg) | Archivos |
| --- | --- | --- | ---: | ---: | --- |
| lava-tube / nominal | contact | contact | 37.64 | 156.91 | [XLSX](Atlas-descenso-lava-tube-nominal.xlsx) · [JSON](Atlas-descenso-lava-tube-nominal.json) · [MD](Atlas-descenso-lava-tube-nominal.md) |
| polar-shadow / nominal | contact | contact | 41.12 | 155.01 | [XLSX](Atlas-descenso-polar-shadow-nominal.xlsx) · [JSON](Atlas-descenso-polar-shadow-nominal.json) · [MD](Atlas-descenso-polar-shadow-nominal.md) |
| hyperarid-salt / nominal | contact | contact | 36.02 | 209.23 | [XLSX](Atlas-descenso-hyperarid-salt-nominal.xlsx) · [JSON](Atlas-descenso-hyperarid-salt-nominal.json) · [MD](Atlas-descenso-hyperarid-salt-nominal.md) |
| wind-canyon / nominal | contact | contact | 36.06 | 209.19 | [XLSX](Atlas-descenso-wind-canyon-nominal.xlsx) · [JSON](Atlas-descenso-wind-canyon-nominal.json) · [MD](Atlas-descenso-wind-canyon-nominal.md) |
| lava-tube / fuel-failure | contact | hard-contact | 11.66 | 0.00 | [XLSX](Atlas-descenso-lava-tube-fuel-failure.xlsx) · [JSON](Atlas-descenso-lava-tube-fuel-failure.json) · [MD](Atlas-descenso-lava-tube-fuel-failure.md) |
| lava-tube / abort | contact | aborted | 5.00 | 179.24 | [XLSX](Atlas-descenso-lava-tube-abort.xlsx) · [JSON](Atlas-descenso-lava-tube-abort.json) · [MD](Atlas-descenso-lava-tube-abort.md) |
| lava-tube / missing-data | contact | unavailable | 0.00 | Sin dato: DEM ausente | [XLSX](Atlas-descenso-lava-tube-missing-data.xlsx) · [JSON](Atlas-descenso-lava-tube-missing-data.json) · [MD](Atlas-descenso-lava-tube-missing-data.md) |

Los cuatro contactos nominales cumplen exclusivamente tolerancias propuestas del modelo. El caso sin combustible conserva velocidad de impacto y checks fallidos; el aborto y los datos ausentes no se presentan como contactos. Shackleton conserva cautela regional y advertencias de interpolación LOLA.

## Verificación independiente

- 30/30 pruebas de reporte/registro/Excel/copiloto, incluidas integración productor UI→recorder sobre los cuatro pares DEM, caps, rechazos atómicos, nulos, legacy 12 hojas, capturas aisladas y resultados no exitosos. Registro: [tests-report.log](tests-report.log).
- Sintaxis de los seis módulos/scripts JS asignados y diff-check limitado a los archivos propios: correctos. No se repitió la suite backend ajena.
- Siete libros del motor leídos con openpyxl: 43030 celdas de datos, cero blanks/no finitos/fórmulas de celdas; referencias del gráfico preservadas. Valores de perfiles, fases, poses, combustible y filas de trayectoria contrastados contra cada JSON.
- Siete libros abiertos y convertidos a PDF por LibreOffice Calc: 22224 celdas de texto de hojas nuevas encontradas en el texto PDF, cero faltantes; portada de vuelo también comprobada. No se afirma revisión en Microsoft Excel.
- Capturas de páginas completas del PDF de Calc conservadas junto con los PDF y el texto extraído. Revisión visual de perfil, trayectoria, ranking y fallo; se añadió precisión suficiente a georreferencias e Isp después de la primera inspección.
- El literal `thermal=null` de una nota de fuente del DEM se presenta como `thermal=sin dato` en Excel. El JSON conserva la nota original; no se alteran datos científicos.

Evidencia mecánica: [engine-report-validation.json](engine-report-validation.json), [xlsx-independent-validation.json](xlsx-independent-validation.json). Capturas/PDF: [render-libreoffice](render-libreoffice/).

## Descarga de interfaz

Las cuatro descargas finales del botón real de interfaz, guardadas por el frente UI en `descenso-3d`, pasaron openpyxl 3.1.5 y el render de LibreOffice Calc 24.2: **21620 celdas de datos** revisadas y **11840 celdas de texto** de hojas nuevas presentes en PDF, sin blanks/no finitos/fórmulas ni texto perdido. Las portadas de vuelo y referencias del gráfico también pasan. La primera descarga con nota literal antigua no se contó como aceptación final; se reexportaron los cuatro libros tras recargar el módulo corregido.

| Descarga UI | Hojas | Filas de trayectoria | PDF Calc | Texto perdido |
| --- | ---: | ---: | --- | ---: |
| [hyperarid-salt.xlsx](../descenso-3d/hyperarid-salt.xlsx) | 15 | 42 | [40 páginas](render-libreoffice/hyperarid-salt.pdf) | 0 |
| [lava-tube.xlsx](../descenso-3d/lava-tube.xlsx) | 15 | 108 | [45 páginas](render-libreoffice/lava-tube.pdf) | 0 |
| [polar-shadow.xlsx](../descenso-3d/polar-shadow.xlsx) | 15 | 112 | [46 páginas](render-libreoffice/polar-shadow.pdf) | 0 |
| [wind-canyon.xlsx](../descenso-3d/wind-canyon.xlsx) | 15 | 42 | [40 páginas](render-libreoffice/wind-canyon.pdf) | 0 |

Misión JSON, dossier JSON y Markdown exportados por la interfaz conservan la misma identidad y captura que el libro. Se comprobó igualdad de `mission.landing`, `dossier.landing`, `analogyDossier.landing` y `landing` raíz de misión; las cuatro fases finales son `exploration`, con ambos resúmenes físicos en `contact`. Las coordenadas del rover objetivo corresponden a su propio contacto más el desplazamiento del rover terrestre, sin copiar el origen terrestre. Resultado: [ui-json-validation.json](ui-json-validation.json).

Se inspeccionaron con `view_image` las páginas completas de Descenso, Trayectoria y candidatos del libro UI La Corona, además de portada, perfiles, candidatos y resultado de fallo de los ejemplos del motor. Las capturas se generaron del XLSX real abierto por Calc; no son maquetas HTML ni capturas de Microsoft Excel.


## Reproducir

```sh
node --test tests/landing-report.test.mjs tests/mission-audit.test.mjs tests/xlsx-report.test.mjs tests/copilot-rules.test.mjs
node scripts/validate-landing-reports.mjs
/tmp/selene-xlsx-venv/bin/python scripts/validate-landing-xlsx.py --render
```

El render usa Calc aislado en `/tmp/selene-lo/root/usr/lib/libreoffice/program/soffice` y sus bibliotecas temporales. `--render --verify-only` verifica PDFs ya generados sin reabrir los libros; argumentos de archivo explícitos permiten validar descargas UI sin escribir en su carpeta.

Contrato: [docs/contracts.md §11](../../contracts.md#11-descenso-final-y-captura-de-misión-m2). M2: [modulo-2.md](../../modulo-2.md). Motor y fuentes: [descenso-modelo.md](../../descenso-modelo.md).

## Límites

Tierra es una comparación virtual sin aerodinámica; Marte solo tramo propulsado final idealizado; Luna sin atmósfera. No hay TRN/visión NASA implementados ni zona segura certificada. DEM regional de 37.5 m no resuelve patas, rocas, pozo o interior de cueva; la resolución nativa más fina no recupera detalle perdido. Vacío, radiación, dinámica del suelo y terramecánica requieren ensayos específicos. UTC, SIM descenso y SIM rover ×20 son relojes separados; exageración visual ×2 no modifica física SI.

## Archivos de este frente

`analog-audit-ui.mjs`, `mission-audit.mjs`, `landing-report.mjs`, `xlsx-report.mjs`, `copilot-rules.mjs`, `docs/contracts.md`, `docs/modulo-2.md`, `tests/landing-report.test.mjs`, `scripts/validate-landing-reports.mjs`, `scripts/validate-landing-xlsx.py` y esta carpeta de evidencia. Los artefactos UI en `descenso-3d` son propiedad del frente UI y solo se leyeron. Motor/UI y la QA global pertenecen a sus frentes; no quedan pendientes del alcance REPORT/M2.
