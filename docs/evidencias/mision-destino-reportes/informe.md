# Misión centrada en destino: reportes y captura

La captura, JSON, Markdown, Excel y copiloto distinguen el **único descenso lunar/marciano** del **ensayo de conducción Tierra**. `target-first` conserva `runs.earth:null` y `history[].earth:null`: «No aplica: sin descenso terrestre». El origen Tierra es una referencia automática en superficie, no un contacto de nave. El contacto nominal del objetivo gobierna despliegue y exploración; su fallo no se rescata con datos Tierra. Sin origen Tierra válido puede completarse el descenso objetivo, pero el espejo queda limitado.

El rover conducido sigue siendo terrestre, con coordenadas y meteorología terrestres. Su desplazamiento se refleja en el destino mediante `contactoTarget + (roverEarth − origenEarth)`. El rover espejo conserva posición/georreferencia planetaria propia; la operación no afirma homología geográfica ni telemetría de hardware. M2 conserva Tierra vs objetivo como evaluación con sus cuerpos, presiones y fuentes originales. Las herramientas siguen siendo propuestas de diseño, sin instrumentos conectados.

## Validación y compatibilidad

- Validador estricto para modo, lado principal, roles, DEM, cuerpo, superficie/origen y contacto propio, además de UTC/SIM, perfiles SI e identidad de sesión. Rechaza contactos/despliegues/exploración globales sin contacto nominal objetivo, vuelo Tierra inventado y espejo incoherente; un rechazo conserva atómicamente la última captura válida.
- El contexto compacto conserva extensiones y roles, omite historial/eventos/raster y mantiene rover Tierra separado del objetivo. El registro de muestras identifica `body:earth`, rol de ensayo y DEM Tierra, sin cambiar la latitud/longitud recibida.
- Excel mantiene el diseño de 15 hojas con captura, filtros A6/congelado A7, estilos, formatos numéricos, áreas de impresión y referencias del gráfico `Resumen!B25:C26`. Descenso presenta objetivo principal y Tierra análogo/referencia, propósito, orígenes y espejo relativo. Trayectoria incluye únicamente estados de vuelos realizados. JSON conserva nulos auténticos.
- Sin captura se mantienen 12 hojas. `paired-legacy` explícito sigue exportando 15 hojas con ambos vuelos; payloads históricos 1.0.0 sin extensiones conservan su validación anterior. No se revalidaron los once artefactos históricos: la compatibilidad se comprobó mediante pruebas sobre payloads/exports actuales.

[Pruebas específicas](pruebas-reportes.tap): **34/34**, sin fallos, sobre reportes, M2, Excel y copiloto. Incluyen los cuatro escenarios con productor real y validación de cada publicación, fallo objetivo, ausencia Tierra, espejo relativo, aislamiento del contexto/captura, rechazo de extensiones forjadas y compatibilidad legacy. La suite global corresponde al responsable UI.

## Ejemplos del controlador real

[Generador reproducible](generar-evidencia.mjs): controlador y motor reales, DEM versionados y UTC controlada de evidencia; no son ejecución UI ni observaciones de vuelo/hardware. Se validaron **188 publicaciones** sin rechazos.

| Caso | Resultado objetivo | Espejo | Muestras / filas trayectoria | Archivos |
|---|---|---|---:|---|
| Marius Hills nominal | contact → exploration | Disponible | 27 | [JSON](Atlas-destino-lava-tube-nominal.json), [XLSX](Atlas-destino-lava-tube-nominal.xlsx), [Markdown](Atlas-destino-lava-tube-nominal.md) |
| Shackleton nominal | contact → exploration | Disponible | 29 | [JSON](Atlas-destino-polar-shadow-nominal.json), [XLSX](Atlas-destino-polar-shadow-nominal.xlsx) |
| Jezero nominal | contact → exploration | Disponible | 27 | [JSON](Atlas-destino-hyperarid-salt-nominal.json), [XLSX](Atlas-destino-hyperarid-salt-nominal.xlsx) |
| Valles Marineris nominal | contact → exploration | Disponible | 27 | [JSON](Atlas-destino-wind-canyon-nominal.json), [XLSX](Atlas-destino-wind-canyon-nominal.xlsx) |
| Objetivo sin combustible | hard-contact; rover retenido | Limitado | 12 | [JSON](Atlas-destino-lava-tube-fallo-objetivo.json), [XLSX](Atlas-destino-lava-tube-fallo-objetivo.xlsx) |
| Sin DEM Tierra | contact → exploration | Limitado | 27 | [JSON](Atlas-destino-lava-tube-sin-tierra.json), [XLSX](Atlas-destino-lava-tube-sin-tierra.xlsx) |
| Jezero personalizado | contact → exploration | Disponible | 27 | [JSON](Atlas-destino-hyperarid-salt-personalizada.json), [XLSX](Atlas-destino-hyperarid-salt-personalizada.xlsx) |

El caso personalizado elige otra zona (`jezero-r29-c41`) y 80 % de combustible objetivo: **208 kg** frente a 260 kg nominales. No modifica el perfil, límites de diseño ni presupuesto Tierra. Los resultados completos están en [validación productor](validacion-productor.json); cada ejemplo tiene respuesta de copiloto y Markdown junto al JSON/XLSX.

## Lectura independiente y render

[Validador openpyxl](validar-xlsx.py) abrió los siete XLSX nuevos y cotejó sus JSON: **32 010 celdas de datos**, cero vacías, cero errores/números no finitos y cero fórmulas. Confirmó las quince hojas, gráfico, estilos, impresión y trayectoria sin filas Tierra. [Resultado estructurado](validacion-xlsx.json).

LibreOffice Calc abrió y exportó el XLSX nominal real a [PDF de 40 páginas](render-calc/Atlas-destino-lava-tube-nominal.pdf). Se verificó que todo el texto de las tres hojas nuevas y el resumen de misión aparecieran en el PDF: **cero textos ausentes/recortados**. Se inspeccionaron visualmente [portada](render-calc/Atlas-destino-lava-tube-nominal-Resumen.png), [Descenso](render-calc/Atlas-destino-lava-tube-nominal-Descenso.png), [Trayectoria](render-calc/Atlas-destino-lava-tube-nominal-Trayectoria.png) y [Zona ensayo](render-calc/Atlas-destino-lava-tube-nominal-Zona_ensayo.png). La revisión es de Calc, no de Microsoft Excel.

## Descargas reales UI

Se cotejaron bytes reales de los Blob de descarga y clicks de enlace de la UI en `http://localhost:8031/`, guardados por el responsable de UI en [misión destino](../mision-destino/). No se reconstruyeron estos archivos con el generador de ejemplos. Se congelaron copias de los bytes descargados en `descargas-ui/` antes del resto de QA, para que una descarga posterior no altere la evidencia cotejada.

| Descarga real | Parámetros / resultado | Validación independiente |
|---|---|---|
| [Luna personalizada XLSX](descargas-ui/personalizado-lava-tube.xlsx), [dossier](descargas-ui/personalizado-lava-tube-dossier.json), [misión](descargas-ui/personalizado-lava-tube-mission.json) | 80 % de combustible objetivo: **144/180 kg**; candidato alternativo `marius-hills-r39-c11` elegido por teclado; exploración con rover ensayo Earth y espejo Moon | 15 hojas, **5 149 celdas**, 38 filas trayectoria objetivo; cero vacías/errores/fórmulas |
| [Jezero nominal XLSX](descargas-ui/nominal-jezero.xlsx), [dossier](descargas-ui/nominal-jezero-dossier.json), [misión](descargas-ui/nominal-jezero-mission.json) | **260/260 kg** de combustible objetivo; zona `jezero-r25-c49`; exploración con rover ensayo Earth y espejo Mars | 15 hojas, **5 126 celdas**, 43 filas trayectoria objetivo; cero vacías/errores/fórmulas |

[Validación de descargas JSON](validacion-descargas-ui.json): captura superior, dossier y sesión idénticos; identidad/UTC/cuerpos/roles/orígenes válidos; Tierra sin vuelo; contexto compacto conserva roles sin historial; desplazamiento del espejo coincide con `contactoTarget + (roverEarth − origenEarth)`. Las muestras registradas mantienen `body:earth` y DEM terrestre. La descarga personalizada contiene cinco muestras del ensayo y un recorrido terrestre de 20 m; su pose lunar es distinta de la pose terrestre. Las dos descargas suman **10 275 celdas de datos** revisadas además de los siete ejemplos; sus resultados openpyxl están en [validacion-xlsx.json](validacion-xlsx.json). La suite global y el resto de QA visual pertenecen al responsable de UI.

## Reproducción local

```sh
node --test tests/target-first-report.test.mjs tests/landing-report.test.mjs tests/mission-audit.test.mjs tests/xlsx-report.test.mjs tests/copilot-rules.test.mjs
node docs/evidencias/mision-destino-reportes/generar-evidencia.mjs
/tmp/selene-xlsx-venv/bin/python docs/evidencias/mision-destino-reportes/validar-xlsx.py
/tmp/selene-xlsx-venv/bin/python docs/evidencias/mision-destino-reportes/validar-xlsx.py --render docs/evidencias/mision-destino-reportes/Atlas-destino-lava-tube-nominal.xlsx
node docs/evidencias/mision-destino-reportes/validar-descargas.mjs docs/evidencias/mision-destino-reportes/descargas-ui/personalizado-lava-tube-mission.json docs/evidencias/mision-destino-reportes/descargas-ui/nominal-jezero-mission.json
/tmp/selene-xlsx-venv/bin/python docs/evidencias/mision-destino-reportes/validar-xlsx.py docs/evidencias/mision-destino-reportes/descargas-ui/personalizado-lava-tube.xlsx docs/evidencias/mision-destino-reportes/descargas-ui/nominal-jezero.xlsx
```

Los scripts operan sobre archivos locales. No se modificaron backend, controlador, UI de misión, perfiles ni motor en este alcance; se preservaron los cambios existentes y no se hizo add/commit/push/deploy.
