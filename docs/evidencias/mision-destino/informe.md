# Misión al destino y rover de ensayo / espejo

Validación local en **http://localhost:8031/**, página Orca `0cab6187-6ca9-462d-81b0-5b32807871ec`. Ejecución del 14 de noviembre de 2026, hora de Guatemala; los registros y descargas conservan UTC del 15 de noviembre. Preview final en preparación limpia de Marius Hills: objetivo único, combustible 100 %, vuelo 1× y autorización manual.

El flujo abre destinos Luna/Marte, prepara solo su zona y carga, explica el análogo terrestre automático y permite compararlo opcionalmente. Solo la nave objetivo desciende y su contacto nominal habilita la revisión manual. Tras autorizar, Tierra conserva el rover de ensayo como autoridad y el destino muestra el rover espejo simulado con desplazamiento relativo desde su contacto propio. No hay nave terrestre, segundo aterrizaje, copia de coordenadas absolutas ni enlace de hardware.

## Comprobaciones

`npm run check`: **196/196 pruebas**, cero fallos, canceladas u omitidas; [salida completa](npm-run-check.log). Conserva las 185 pruebas anteriores y añade las 11 de controlador/reporte target-first. Se ejecutó después de cerrar ambos frentes de controlador y M2.

| Recorrido del navegador real | Comprobaciones registradas | Evidencia |
| --- | ---: | --- |
| Escritorio 1440×1000 · cuatro escenarios | 48 | [desktop-only-checks.json](desktop-only-checks.json) |
| Móvil 390×844 · cuatro escenarios | 41 | [mobile-only-checks.json](mobile-only-checks.json) |
| Preferencia real de movimiento reducido | 3 | [motion-only-checks.json](motion-only-checks.json) |
| DEM Earth ausente y WebGL no disponible | 5 | [fallback-only-checks.json](fallback-only-checks.json) |
| Copiloto, NASA, orden del registro y ciclo de página | 6 | [extras-only-checks.json](extras-only-checks.json) |
| Coordenadas de cada panel e índice móvil | 4 | [mirror-only-checks.json](mirror-only-checks.json) |

Las comprobaciones activan controles y eventos de la aplicación renderizada en Orca, esperan sus cuadros reales y exportan desde la UI; no llaman al controlador ni sustituyen el motor, el reloj o el renderer. Las continuaciones de escritorio conservan las misiones ya verificadas. Se inspeccionaron las capturas guardadas, no solo su existencia.

Cobertura: un mapa y slider target; 1× inicial; selección por teclado y foco; cuatro velocidades y cámaras sin cambiar identidad; pausa con SI inmóvil; comparación que conserva sesión; contacto objetivo suficiente; órdenes alternas sin eludir autorización; fallo target con Earth válido que retiene rover; reinicio editable; retorno al catálogo de 14 sitios incluso al sitio ya seleccionado; parejas con roles, cuerpo y offset propios; conducción terrestre que mueve el espejo; pendientes/actitudes propias; transmisión y cámara mástil; conservación de NASA y contexto compacto del copiloto; historial UTC/SIM ordenado.

Sin DEM terrestre el destino aterriza y despliega, pero el espejo queda desactivado con explicación. La exportación identifica el rover terrestre como no disponible, con x/z nulos y ruta vacía, sin inventar `(0,0)` como origen. La cámara sigue mostrando el contacto objetivo. Sin WebGL permanecen controles, mapa 2D, radar, motor y descargas, con explicación de la vista 2D y sin mapa terrestre presentado como destino.

El preview tenía IA externa desactivada: la respuesta del copiloto se probó con reglas locales y su sesión real. La forma del contexto compacto se valida además en la suite y en el frente de reportes; no se fingió una solicitud a un proveedor IA.

## Contactos observados en escritorio

| Escenario | Cuerpo | Tiempo SIM s | Contacto x, z m | Propelente restante kg |
| --- | --- | ---: | --- | ---: |
| lava-tube | moon | 37.61 | -789.29, 263.65 | 121.73 |
| polar-shadow | moon | 41.08 | -37.65, -337.40 | 155.03 |
| hyperarid-salt | mars | 36.01 | 637.75, -262.67 | 209.25 |
| wind-canyon | mars | 36.08 | -937.25, -487.67 | 209.16 |

Lava-tube usa la preparación personalizada de 80 % y candidato alternativo elegido por teclado; los otros tres usan preparación nominal. Los valores son resultados del motor virtual sobre DEM archivados. No certifican terreno ni representan EDL completo.

## Descargas reales

Los archivos se obtuvieron de los Blob generados por los botones de descarga y sus clicks de enlace reales; se conservaron sus bytes sin reconstruir el informe. JSON de misión, dossier y registro de vuelo coinciden en identidad y contenido. Una lectura independiente con openpyxl comprobó 15 hojas por archivo, gráfico conservado, cero celdas de datos vacías, números finitos y ninguna fórmula/error. La trayectoria tiene solo filas del objetivo.

| Descarga UI | Carga inicial target kg | Filas trayectoria | Celdas revisadas |
| --- | ---: | ---: | ---: |
| [personalizado-lava-tube.xlsx](personalizado-lava-tube.xlsx) · [misión](personalizado-lava-tube-mission.json) · [dossier](personalizado-lava-tube-dossier.json) | 144 | 43 | 5264 |
| [nominal-jezero.xlsx](nominal-jezero.xlsx) · [misión](nominal-jezero-mission.json) · [dossier](nominal-jezero-dossier.json) | 260 | 47 | 5224 |

[Cotejo local de descargas](validacion-descargas.json). El frente M2 cotejó además copias congeladas de ambas descargas, 188 publicaciones y siete ejemplos, y abrió/renderizó un libro con Calc: [informe independiente](../mision-destino-reportes/informe.md). Las copias congeladas conservan sus propios IDs y cortes UTC; nuevas exportaciones crean cortes nuevos.

## Capturas inspeccionadas

- [Escritorio: preparación del destino](desktop-preparacion.png), [mapa único](desktop-mapa-objetivo.png) y [referencia opcional sin nave Earth](desktop-referencia.png).
- [Escritorio: descenso](desktop-descenso.png), [contacto lunar](desktop-contacto.png), [contacto marciano](desktop-contacto-jezero.png) y [rovers ensayo/espejo](desktop-rovers-jezero.png).
- [Móvil: preparación](movil-preparacion.png), [descenso](movil-descenso.png), [contacto](movil-contacto.png), [rover de ensayo Earth](movil-rover-ensayo.png) y [rover espejo lunar](movil-rover-espejo.png).
- [Movimiento reducido](movil-movimiento-reducido.png), [sin DEM Earth](missing-earth.png), [sin WebGL](webgl.png), [NASA conservada](desktop-nasa-conservada.png) y [preview final](preview-final.png).

## Reproducir

Con el preview ya activo y Orca abierto, desde Atlas:

```sh
npm run check
python3 scripts/qa-target-mission.py 0cab6187-6ca9-462d-81b0-5b32807871ec http://localhost:8031/ --desktop-only
python3 scripts/qa-target-mission.py 0cab6187-6ca9-462d-81b0-5b32807871ec http://localhost:8031/ --mobile-only
python3 scripts/qa-target-mission.py 0cab6187-6ca9-462d-81b0-5b32807871ec http://localhost:8031/ --motion-only
python3 scripts/qa-target-mission.py 0cab6187-6ca9-462d-81b0-5b32807871ec http://localhost:8031/ --fallback-only
python3 scripts/qa-target-mission.py 0cab6187-6ca9-462d-81b0-5b32807871ec http://localhost:8031/ --extras-only
python3 scripts/qa-target-mission.py 0cab6187-6ca9-462d-81b0-5b32807871ec http://localhost:8031/ --mirror-only
```

El ID de página pertenece a esta sesión Orca; otra sesión debe usar el ID obtenido de `orca-ide tab list --json`. `--resume` continúa casos completos guardados si se interrumpe el proceso de QA. Los entrypoints QA anteriores redirigen a los recorridos vigentes.

No se modificaron ecuaciones, DEM, launcher, recursos NASA, backend ni documentos personales; controlador y reportes permanecieron en sus frentes asignados. Todo queda local, sin add/commit/push/deploy. El clima actual es modelo meteorológico terrestre del proveedor y el espejo es una simulación sin hardware conectado.
