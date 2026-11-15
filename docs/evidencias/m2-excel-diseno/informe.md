# Excel M2 · Dossier Mission Control

Implementación local completa del rediseño y de su integración con los cuatro perfiles de misión. Preview de aplicación: **http://localhost:8027/**. Descargas y vistas: **http://localhost:8027/docs/evidencias/m2-excel-diseno/index.html**.

## Resultado

El escritor OOXML propio conserva las doce hojas y añade portada editorial, misión/objetivo, corte UTC, estado de fuente, indicadores, leyenda de tipos, navegación interna y gráfico Excel nativo de cargas verticales para `offload` y `equivalent`. Usa navy `07173F`, azul `0042A6`, cyan `2E96F5`, acento `EAFE07`, texto Calibri y números Consolas, bordes finos, bandas alternas y estados verde/ámbar/rojo. Las tablas empiezan en A6, se congelan en A7, tienen filtros sobre su región real, formatos numéricos SI, wrap, alturas, márgenes, áreas y títulos de impresión. La portada A4 no tiene filtro; el detalle usa A3 horizontal para conservar legibilidad.

El perfil creado por el worker independiente se integra en Excel y UI: ocho herramientas por misión, 51 parámetros en Marius/Shackleton/Jezero y 53 en Coprates. Cada valor base tiene unidad, tipo, fuente, justificación y ámbito de masa. Se distingue masa global del rover, componentes incluidos, kits externos y bancos. El rover sigue en **350 kg**; no se modificó `rover-config.mjs` ni se atribuyeron parámetros a mallas NASA.

La base térmica se calcula aparte con `calibrateEngineering`, con aire y pared isotermos como hipótesis explícita del banco (`airK = surroundingsK`). No se reemplaza el aire observado ni se completa la térmica actual con setpoints. En el banco de Shackleton, `h=0` produce Q convectiva numérica cero e idealiza gas residual; no afirma un vacío físico perfecto. Convección base: 48 / 0 / 48 / 108 W en el orden Marius, Shackleton, Jezero y Coprates. Radiación base: 36,9119727353 / 229,5612414437 / 32,4707298722 / 41,5259693273 W.

No hay celdas vacías, literales `null`/`undefined`, NaN ni Infinity en las regiones de datos. Las ausencias se representan con causa y contexto; no se convierten en ceros ni lecturas inventadas. El JSON canónico conserva `null` honesto, la sesión abierta dice «En curso» y las divisiones por cero lunares dicen «No aplica: vacío ideal / división por cero». El historial nuevo conserva inicio/corte; la precipitación no solicitada se omite. Las unidades desconocidas de mallas se presentan como «Escala visual; unidades físicas no verificadas» y las texturas muestran dimensiones del manifiesto, 2048 × 1024 píxeles, como contexto visual.

## Archivos revisables

| Archivo | Fuente y alcance |
|---|---|
| [Atlas-M2-lava-tube-Mission-Control.xlsx](Atlas-M2-lava-tube-Mission-Control.xlsx) | Marius Hills / Lanzarote; terreno versionado + snapshot meteorológico |
| [Atlas-M2-polar-shadow-Mission-Control.xlsx](Atlas-M2-polar-shadow-Mission-Control.xlsx) | Shackleton / Wright Valley; terreno versionado + snapshot meteorológico |
| [Atlas-M2-hyperarid-salt-Mission-Control.xlsx](Atlas-M2-hyperarid-salt-Mission-Control.xlsx) | Jezero / Atacama; terreno versionado + snapshot meteorológico |
| [Atlas-M2-wind-canyon-Mission-Control.xlsx](Atlas-M2-wind-canyon-Mission-Control.xlsx) | Coprates / Wadi Rum; conserva targetId `valles-marineris` + snapshot meteorológico |
| [Atlas-M2-offline-parcial.xlsx](Atlas-M2-offline-parcial.xlsx) | Snapshot sin perfil ni manifiesto adjuntos, sin API y con campos parciales; ceros explícitos del simulador |
| [Atlas-M2-descarga-UI-real.xlsx](Atlas-M2-descarga-UI-real.xlsx) | Descarga desde el botón real en navegador Orca, backend y proveedor meteorológico disponibles |
| [Atlas-M2-offline-UI.xlsx](Atlas-M2-offline-UI.xlsx) | Descarga desde el botón real con fallo de proveedor controlado; fallback identificado como archivo |

Los cuatro ejemplos principales usan meteorología archivada observada el **2026-11-14T17:00:00Z**, no una consulta actual. No tienen muestras rover inventadas. La descarga UI real conserva modelo del proveedor, hora, fuente y muestras estacionarias del simulador; no afirma un sensor local ni movimiento. `real-api.json` y `browser-real.json` conservan la evidencia de fuente/fecha. La fase de fallo de proveedor está separada en `browser-offline.json`; se restauró el preview sin mocks.

## Verificación ejecutada

- **`npm run check`: 134/134 pruebas JS aprobadas**, incluida configuración automática, sesiones, cuatro IDs, perfiles y seis pruebas nuevas del dossier. Log: [js-check.txt](js-check.txt). No se repitieron las 135 pruebas del backend porque no se modificó backend.
- **Lectura independiente: openpyxl 3.1.5** sobre los siete XLSX y 9.300 celdas de datos sin vacíos; CRC ZIP, relaciones internas, estilos, áreas de impresión, filtros A6/congelado A7, números, ceros, setpoints, pesos y ambos modos, ocho instrumentos completos, fuentes de archivo/modelo, ausencia de datos vacíos y fixture Unicode/XML/formula injection. [xlsx-validation.json](xlsx-validation.json). Los strings `=`, `+`, `-`, `@` siguen siendo texto; no hay fórmulas de celdas, macros ni relaciones externas.
- **Render real: LibreOffice Calc 24.2.7.2, 420(Build:2)** extraído en `/tmp/selene-lo/root`, sin instalación global. Se abrieron y exportaron los siete XLSX a PDF: 149 páginas completas, con los 10.056 textos de celda localizados en sus PDFs. [render-validation.json](render-validation.json), [PDFs/PNG](index.html). No se afirma revisión en Microsoft Excel. Calibri/Consolas pueden usar sustitución local por las fuentes instaladas.
- **Revisión visual con `view_image`**: cuatro portadas y páginas completas de herramientas, térmica y calibración. Se corrigieron anchos/legibilidad y se desglosó una evidencia geométrica que inicialmente se cortaba; el render final no pierde texto de ninguna celda. [Cuatro portadas](cuatro-portadas.png), [portada](vista-portada.png), [herramientas](vista-herramientas.png), [térmica](vista-termica.png), [calibración](vista-calibracion.png). Las imágenes proceden de los XLSX reales exportados por Calc, no de una recreación HTML.
- **Navegador real Orca**: parámetros de los cuatro perfiles coinciden con la UI; laboratorio a 100 kg exporta auditoría automática de 350 kg y térmica actual incompleta; perfiles no se añaden como lecturas; móvil 390 px sin overflow; consola vacía. Descargas real y offline mediante el botón. [browser-regression.json](browser-regression.json), [consola](browser-console.json), [UI escritorio](ui-perfil-desktop.png), [UI móvil](ui-perfil-mobile.png).

Los SHA256 de los siete XLSX están en [sha256.json](sha256.json). `git diff --check` pasa para los archivos de esta tarea. Los cambios ajenos de revisión 2025 y `docs/assets/` se conservaron sin editarlos; backend, activos científicos y scripts NASA permanecieron fuera del alcance.

## Reproducción local

Desde `Atlas`:

```sh
npm start -- --port 8027
node scripts/generate-m2-dossier-examples.mjs
python scripts/validate-m2-xlsx.py
python scripts/check-m2-dossier-browser.py --page <id-de-pagina-Orca>
python scripts/render-m2-xlsx.py --soffice <ruta-a-LibreOffice>
```

`validate` requiere openpyxl; `render` requiere openpyxl y PyMuPDF, además de Calc. En esta sesión se usó `/tmp/selene-xlsx-venv/bin/python` y `--soffice /tmp/selene-lo/root/usr/lib/libreoffice/program/soffice --lib-path /tmp/selene-lo/root/usr/lib/libreoffice/program:/tmp/selene-lo/root/usr/lib/x86_64-linux-gnu`. Se descargaron DEB oficiales mediante `apt-get download`, se extrajeron con `dpkg-deb -x`, se corrigieron rutas de bootstrap dentro de `/tmp` y se copiaron las configuraciones `.registry` al directorio aislado; no se ejecutó instalación global.

El preview está en la terminal Orca **term_5fca6f20-6179-4a2d-88bc-1fd12f689512**. El puerto 8027 no respondía al inicio y se inició un servidor propio; no se cerraron los servidores ajenos de 8000/8028. Los cambios permanecen locales, sin add, commit, push ni deploy. No quedan integraciones pendientes del perfil ni entregables solicitados por completar.
