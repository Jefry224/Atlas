# Preparación, descenso y exploración 3D · integración local

Implementado en Atlas sin publicar, añadir al índice Git, crear commits o modificar backend, datos científicos y modelos NASA. Se preservaron los cambios ajenos del launcher y la revisión de referentes. El frente UI consume los módulos reales de motor y reportes; no contiene una física alternativa ni resultados de contacto prefijados.

## Preview y reproducción

- URL local activa: **http://localhost:8031/**; API del mismo origen: **http://localhost:8031/api/health** (`status:ok`, versión 2.0.0).
- Comando: `npm start -- --host 0.0.0.0 --port 8031` desde Atlas. Terminal Orca del servidor: `term_f1bd05df-9834-4f6e-be6d-92db0704c088`. No se detuvieron servidores existentes en 8000/8027/8028.
- Página Orca de revisión final: `4265c8ac-e879-433a-914d-f8a291b8c8f2`.
- Seleccionar cualquier escenario A.R.E.S. y pulsar Iniciar misión. El catálogo de catorce sitios conserva exploración directa con rover, rotulada por separado.

## Resultado entregado

El flujo enlaza reconocimiento regional breve, descenso propulsado calculado, contacto, despliegue y exploración desde el contacto terrestre. Los dos cuerpos tienen sus propios candidatos, DEM, estados y perfiles de nave. El objetivo aplica el desplazamiento del rover terrestre desde su propio contacto; fuera de su cobertura o sin contacto nominal se oculta su rover y no se inventa una muestra. Su actitud y la pendiente usada en el contexto del rover se consultan en sus propias coordenadas.

Se muestran tres candidatos por cuerpo, criterios y resolución del producto, marcador científico rosa, pendientes regionales, trayectoria prevista esquemática y trayectoria calculada. La nave esquemática propia incluye patas, motor, antena, pluma y sombra ilustrativa. Hay cámaras Exterior, Inferior y Orbital, más la transmisión de rover existente tras el despliegue. El índice geométrico flotante se oculta durante vuelo para despejar las bandas de instrumentos.

El CTA principal inicia, pausa o reanuda según el estado; después de un fallo ofrece reiniciar. No abre otra sesión al reanudar. Reiniciar limpia vuelo y controles. Pausa, cambio de vista, página oculta y pagehide retienen el rover y detienen el vuelo. Se limpian teclas/pulsos táctiles al pausar o cambiar contexto; un pulso anterior no puede borrar una entrada de una sesión nueva.

UTC, SIM de descenso ×4 y SIM de rover ×20 permanecen separados. El controlador contabiliza frames lentos hasta un segundo real por actualización y delega todos los subpasos SI de hasta 0,05 s al motor común. Registra hasta 4 Hz de reloj real, con menor frecuencia si el navegador no entrega suficientes frames; no exporta 60 Hz ni raster/mallas. Se mantienen 1200 muestras y 300 eventos como máximos. El resultado terminal se publica inmediatamente.

## Vuelos de la UI real

Datos de los JSON y XLSX descargados mediante los botones reales de la aplicación, con reloj UTC real del navegador. Son ensayos virtuales del modelo, no vuelos físicos. La selección terrestre de La Corona se cambió al segundo candidato para comprobar su propagación al vuelo y al reporte.

| Escenario | Tierra SIM (s) | Objetivo SIM (s) | Resultado físico Tierra / objetivo | Muestras de vuelo | Descarga |
| --- | ---: | ---: | --- | ---: | --- |
| La Corona / Marius Hills | 31,63 | 37,63 | contact / contact | 54 | [Excel](lava-tube.xlsx), [misión JSON](lava-tube-mission.json), [dossier](lava-tube-dossier.md) |
| Wright Valley / Shackleton | 31,56 | 41,09 | contact / contact | 54 | [Excel](polar-shadow.xlsx), [misión JSON](polar-shadow-mission.json), [dossier](polar-shadow-dossier.md) |
| Atacama / Jezero | 31,61 | 36,04 | contact / contact | 18 | [Excel](hyperarid-salt.xlsx), [misión JSON](hyperarid-salt-mission.json), [dossier](hyperarid-salt-dossier.md) |
| Wadi Rum / Coprates | 31,58 | 36,07 | contact / contact | 21 | [Excel](wind-canyon.xlsx), [misión JSON](wind-canyon-mission.json), [dossier](wind-canyon-dossier.md) |

El rover permanece a velocidad y recorrido cero durante el vuelo; su primer punto de ruta coincide con el contacto terrestre. Cada georreferencia de contacto conserva el marco del DEM calculado por el motor. Los cuatro dossiers coinciden con la captura de la misma sesión M2 y con el JSON de misión. La muestra final conserva los dos resultados, aunque los cuerpos contactan en instantes SIM distintos.

En móvil real a **390 × 844 px**, los cuatro escenarios completaron el flujo sin desbordamiento. Tiempos reales aproximados, incluidos los comandos de control: La Corona 15,29 s, polar 14,94 s, Atacama 13,63 s y Wadi Rum 14,00 s. El selector Tierra/Objetivo funcionó en los cuatro; el drive-pad movió el rover después del contacto. [Registro móvil](mobile-checks.json).

## Validación

- **177/177 pruebas** y sintaxis mediante `npm run check`, incluida la regresión JS/Python corregida por el coordinador. [Registro completo](npm-check.log).
- **5/5 pruebas del controlador**: cuatro pares DEM reales, publicación válida, sesión aislada, pausa, dt acotado, origen propio del objetivo, aborto, datos ausentes, combustible cero y fallo solo del objetivo sin inventar rover objetivo. [Registro](controller-tests.log).
- **46 comprobaciones de navegador** de los cuatro vuelos desktop y controles/fallos: candidato elegido, contacto, despliegue único, pose inicial, identidad M2, descargas reales, reset, aborto, fallo sin combustible, DEM terrestre ausente, cambio rápido y pausa al salir de comparación. [Resultados](browser-checks.json).
- **8 comprobaciones finales** de CTA/HUD, sesión al reanudar, stream y cámara de mástil, copiloto con fase/propelente actual y carga real del GLB lunar de la galería. La galería mantiene su carga diferida al entrar al viewport. [Resultados](final-ui-checks.json).
- **7 comprobaciones de fallback** con el index y módulos reales en un iframe del mismo origen, WebGL no disponible antes de ejecutar scripts y `prefers-reduced-motion: reduce` emulado por Orca. Se completó el vuelo, se conservó el mismo registro, y teclas/drive-pad no movieron el rover antes del contacto. Se probaron los manejadores pagehide/pageshow con `persisted:true`; esto no se presenta como una prueba de restauración nativa completa del historial del navegador. [Resultados](fallback-checks.json), [misión](fallback-mission.json).
- **4/4 escenarios móviles**, incluido drive-pad posterior al contacto. [Resultados](mobile-checks.json).
- Las cuatro descargas Excel de quince hojas fueron leídas de forma independiente por el frente REPORT/M2 con openpyxl y LibreOffice Calc: sin celdas de datos vacías/no finitas, fórmulas o texto perdido; pose, perfiles, historia y sesión coinciden con el dossier. No se afirma inspección en Microsoft Excel. [Informe independiente](../descenso-informe/INFORME.md).
- No se repitieron los 142 tests backend ajenos. Diff-check limitado a los archivos UI/README/package propios: limpio. El launcher existente sirvió API y web sin modificación por este frente.

## Capturas inspeccionadas

- [Desktop: descenso pausado, HUD despejado y CTA Reanudar](desktop-descenso.png).
- [Desktop: exploración marciana](desktop-marte-exploracion.png).
- Móvil: [La Corona](mobile-lava-tube.png), [polar](mobile-polar-shadow.png), [Atacama](mobile-hyperarid-salt.png), [Wadi Rum](mobile-wind-canyon.png), [lecturas del contacto polar](mobile-polar-contacto.png).
- [Fallback y movimiento reducido](fallback-reducedmotion.png).

Se inspeccionaron las imágenes con `view_image`, incluidas las bandas de instrumentos despejadas y las vistas móviles. Los archivos registran simulaciones de esta ejecución local.

## Límites visibles

El DEM regional a 37,5 m no resuelve patas, rocas, arena suelta ni geometría de cavidad. No hay zona segura certificada. Los perfiles de nave son propuestas separadas del rover de 350 kg; gravedad, empuje y combustible difieren por cuerpo, de modo que la comparación no aísla exclusivamente gravedad. Tierra es una comparación virtual; Luna no tiene atmósfera en el modelo; Marte representa solo descenso propulsado final, sin entrada/paracaídas/EDL completo. No se implementaron TRN, sensores o visión NASA. La meteorología terrestre aporta contexto, no fuerzas marcianas. El relieve ×2 y la nave ×6 son escalas visuales excluidas de la física SI.

No se añadió replay ni vídeo; no son necesarios para el flujo solicitado. No quedan bloqueos de integración. Los detalles científicos y ecuaciones pertenecen al [motor común](../../modules/descenso-modelo.md); la [guía de uso](../../modules/descenso-uso.md) documenta los controles y el alcance.

## Archivos del frente UI

`mission.js`, `index.html`, `styles.css`, `landing-controller.mjs`, `landing-view.mjs`, `tests/landing-controller.test.mjs`, `scripts/qa-landing-browser.py`, `scripts/qa-landing-fallback.py`, `scripts/qa-landing-mobile.py`, `scripts/qa-landing-final-ui.py`, `docs/descenso-uso.md` y esta carpeta. README solo añade la sección de descenso; package.json conserva dev/start y amplía check con los módulos landing. Motor y reportes fueron integrados sin editar sus archivos exclusivos.
