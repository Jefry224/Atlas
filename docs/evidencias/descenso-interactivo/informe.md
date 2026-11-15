# Atlas: descenso interactivo y mando de superficie

Entrega local del 14 de noviembre de 2026, hora de Guatemala. Preview activo: **[http://localhost:8031/](http://localhost:8031/)**; `/api/health` respondió `status: ok`. Se reutilizó el preview existente, sin detener servidores ajenos. No se hizo add, commit, push ni deploy.

## Resumen para el usuario

- **El visor tiene más protagonismo y un mando propio.** La consola azul/amarilla agrupa una acción clara por etapa: preparar, descender, revisar, desplegar y explorar; en móvil agrega pausa y regreso al mando junto a la escena.
- **Tus elecciones cambian el ensayo.** Los mapas del DEM permiten elegir contactos con clic, tap o teclado; las cartas se sincronizan y explican pendiente, desnivel y distancia a ciencia. La carga por cuerpo cambia los kilogramos y la masa inicial que recibe el motor.
- **El contacto requiere una decisión.** Se muestran los dos resultados y el rover espera hasta pulsar Desplegar rover; pausar/reanudar, el CTA anterior y los controles de transmisión no saltan esa autorización.
- **La experiencia se sigue mejor.** Hay cámaras claras, velocidades 0,5×/1×/2×/4× con inicio a 1×, instrumentos con unidades, progreso de propelente, transiciones de etapas y cámara, estados de pausa y respeto a movimiento reducido. NASA, M2, exportaciones y conducción del rover siguen disponibles.

## Comportamiento implementado

El plan regional usa tres candidatos por cuerpo, marcos locales independientes y un mapa cuadrado con escala x/z uniforme. Los colores azules proceden de elevaciones del DEM normalizadas dentro de cada mapa; no representan una imagen satelital ni una escala absoluta compartida. Los marcadores tienen margen para conservar su área de interacción y el contorno de foco incluso cerca del borde. La selección llama a `controller.choose`; ningún cálculo de descenso se duplicó en la vista.

Los sliders 0–100 % usan los perfiles propuestos reales del proyecto y devuelven condiciones iniciales por cuerpo. Los presets avanzados de fallo actualizan los mismos sliders. Carga y región se bloquean al iniciar. Reiniciar devuelve una sesión limpia, 100 % y 1×. El porcentaje no se presenta como probabilidad ni suficiencia calculada.

El mando conserva los mismos controles e instrumentos en el DOM mientras cambia la telemetría del modelo. No reconstruye el control enfocado cada frame y no roba scroll al cambiar de etapa. Ver aterrizaje, Elegir zona y carga, Revisar contacto y Conducir rover navegan por acciones explícitas. Una guía breve descartable recuerda su estado; QA comprobó persistencia y luego restauró el primer uso limpio del preview.

El flujo integra el contrato del controlador (`setOptions`, `requestDeployment`, `options`, 1× y manual por defecto). Durante contacto no se usa Reanudar para autorizar. Las tasas cambian hacia adelante y registran eventos sin reescribir estados previos. La pausa de exploración usa el estado propio del rover. La transmisión del rover queda disponible después del despliegue. Las animaciones de etapa, selección, propelente y cámara afectan a la presentación; no cambian la trayectoria física ni simulan sensores. La transición a la cámara de exploración es gradual, con salida inmediata al pedir movimiento reducido.

## Verificación ejecutada

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| `npm run check` final | **185/185 pruebas**, cero fallos | [npm-check.log](npm-check.log) |
| Recorrido principal del navegador Orca | **46 comprobaciones** | [checks.json](checks.json) |
| Cuatro escenarios en móvil real del navegador, 390×844 y puntero coarse | **19 comprobaciones** | [mobile-checks.json](mobile-checks.json) |
| Emulación real de `prefers-reduced-motion: reduce`, persistencia de guía y restauración | **4 comprobaciones** | [motion-checks.json](motion-checks.json) |
| Descarga JSON/XLSX desde sus acciones de UI y lectura del ZIP/XML | Correcta; 15 hojas, selección, carga e identidad presentes | [xlsx-xml-check.json](xlsx-xml-check.json) |
| Lectura independiente con openpyxl 3.1.5 | Correcta; cargas, candidatos, contacto y autorización coinciden con JSON | [xlsx-openpyxl-check.json](xlsx-openpyxl-check.json) |

En total: **69 comprobaciones de navegador**, además de la suite de 185 pruebas. Los recorridos usan el motor y los escritores existentes; no sustituyen física ni reportes. Incluyen teclado/foco, estabilidad del scroll, mapas y cartas, bloqueo de preparación, cambio prospectivo de tasa, pausa, puerta de contacto, fallo sin propelente, interrupción, fallo solo del objetivo, DEM ausente, reinicio, WebGL no disponible, pagehide/pageshow, catálogo legacy, galería/M2 y transmisión/cámara de mástil del rover. Los cuatro escenarios completaron contactos calculados y despliegue autorizado tanto en escritorio como en móvil.

Resultados del smoke de escritorio, en segundos SIM independientes:

| Escenario | Tierra | Objetivo | Resultado |
| --- | --- | --- | --- |
| lava-tube | 31.60 s | 37.66 s | Contactos nominales; despliegue autorizado |
| polar-shadow | 31.58 s | 41.09 s | Contactos nominales; despliegue autorizado |
| hyperarid-salt | 31.58 s | 36.02 s | Contactos nominales; despliegue autorizado |
| wind-canyon | 31.58 s | 36.06 s | Contactos nominales; despliegue autorizado |

La medición de tasa registró 0.508 s SIM a 0,5× y 4.200 s SIM a 4× en ventanas de observación de aproximadamente 1,2 s reales; son estados muestreados, no una garantía de FPS o cronometraje exacto. El cambio en pausa conservó íntegros los estados e historial anteriores. Ver [rates.json](rates.json).

## Sesión personalizada y descargas

Misión `d07d2d18-ec3c-43b2-b3ab-05e4f847a45f`, escenario lava-tube, modo manual de despliegue. Tierra al 85 %: **552,5 kg** de propelente y **1402,5 kg** de masa inicial; Luna al 90 %: **162 kg** y **1012 kg**. Elegidos desde los mapas: Tierra `la-corona-r47-c61` y Luna `marius-hills-r39-c11`. Esas identidades aparecen en los destinos físicos y en el reporte.

Se capturaron los bytes de los Blobs producidos por las acciones reales de descarga de la UI, conservando sus escritores. El [JSON de sesión](sesion-personalizada.json) y el [Excel M2](sesion-personalizada.xlsx) contienen la misma identidad de misión. ZIP/XML y openpyxl comprobaron Descenso, Trayectoria y Zona_ensayo, las dos cargas iniciales, candidatos, tiempos/propelente finales y el evento de autorización. No se revalidaron los once libros históricos: sus escritores no cambiaron en esta tarea. [Fallo sin propelente](fallo-sin-propelente.json) conserva el resultado negativo y el rover retenido.

## Inspección visual

Se abrieron las imágenes mediante `view_image`, comparando antes/después y revisando instrumentos, foco, separaciones y CTA. El HUD se mantiene dentro del visor, separado de las herramientas y de la acción móvil; el botón de contacto dice Desplegar rover en el mando y Revisar contacto en el acceso desde el visor. Las capturas muestran simulaciones locales.

- [Antes: controles bajo la escena](antes-desktop.png).
- [Escritorio: preparación y mando](desktop-preparacion.png), [mapas y selección](desktop-mapa.png), [carga](desktop-carga.png), [vuelo pausado](desktop-vuelo.png) y [contacto con acción](desktop-contacto.png).
- [Móvil: preparación](movil-final-preparacion.png), [mapa con foco y margen](movil-final-mapa.png), [contacto](movil-contacto.png), [visor y HUD](movil-wind-canyon-visor.png) y [movimiento reducido](movil-movimiento-reducido.png).
- [Estado final del preview](desktop-final.png): preparación editable, sin vuelo activo, carga 100 %, tasa 1× y sin desbordamiento horizontal.

## Alcance y límites

Se modificaron landing-view.mjs, mission.js, index.html, styles.css, esta evidencia, la guía de uso y el nuevo QA interactivo. Los cuatro QA legacy de landing se adaptaron, bajo autorización del coordinador, a las etiquetas actuales, la tasa 4× explícita para sus ventanas históricas y la autorización manual; se verificaron sintaxis Python y expresiones JavaScript estáticas. El recorrido ejecutado y reproducible de esta entrega es el nuevo QA interactivo. package.json conserva su cambio previo; no necesitó otro helper ni dependencia.

El otro frente aportó el contrato del controlador y sus pruebas. Esta tarea no editó controlador, física, perfiles, escritores de reportes/XLSX, launcher, revisión personal, PDF ni docs/assets. Se conservaron los cambios previos y las evidencias históricas.

Este prototipo ensaya el **descenso propulsado final idealizado** con DEM regional; no implementa EDL completo, TRN, visión NASA ni sensores. El contacto del modelo no certifica el terreno. El control de la nave es automático; los controles manuales corresponden al rover después del despliegue. La representación regional no resuelve patas, rocas o cavidades. Las pruebas móviles corresponden a emulación de navegador Orca con 390×844 y puntero coarse, no a una campaña en dispositivos físicos. El escenario sin WebGL bloqueó solo la capacidad gráfica en un iframe del mismo origen y mantuvo el motor real.

No quedan bloqueos de esta entrega local. Guía actualizada: [descenso-uso.md](../../modules/descenso-uso.md).

## Reproducir

Con Orca y el preview ya abiertos, obtener el PAGE_ID de `orca-ide tab list --json` y ejecutar desde Atlas:

```sh
npm run check
python3 scripts/qa-landing-interactive.py PAGE_ID http://localhost:8031/
python3 scripts/qa-landing-interactive.py PAGE_ID http://localhost:8031/ --mobile-only
python3 scripts/qa-landing-interactive.py PAGE_ID http://localhost:8031/ --motion-only
```

El último recorrido restaura el preview de escritorio en preparación limpia y la preferencia de movimiento sin reducción. No inicia ni detiene servidores.
