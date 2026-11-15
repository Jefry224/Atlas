# Módulo 2 · Ruptura de analogía y calibración

Implementación local integrada en Atlas, 14 de noviembre de 2026. No exige backend, claves, servicios de pago ni conexión para el motor. Usa los cuatro escenarios, las métricas DEM y la telemetría existentes; no crea mediciones. Es una auditoría exploratoria por parámetro, sin nota de similitud física global ni certificación de misión.

## Uso local

Desde `Atlas`, prepará el entorno y abrí el backend que sirve interfaz y API del mismo origen:

```bash
python3 -m venv .venv-server
.venv-server/bin/python -m pip install -r server/requirements.txt
npm start -- --port 8027
# http://localhost:8027
# Alternativa sin API: npm run start:static -- 8028
```

El launcher busca `ATLAS_PYTHON`, `.venv-server` local y Python del PATH, verifica dependencias y explica cómo instalarlas si faltan; no instala ni cambia proveedores. La configuración opcional de proveedores usa variables de entorno; la opción avanzada de uvicorn `--env-file .env` sigue documentada en el backend.

1. Elegí cualquier escenario A.R.E.S.: M2 toma automáticamente cuerpo, gravedad, centros geográficos, DEM y configuración del rover. `rover-config.mjs` es la fuente única de los 350 kg (`prototype-config`) tanto para el consumo simulado como para M2. No es la masa real de Perseverance ni Scarecrow.
2. Iniciá el rover desde la consola. El panel muestra posición, rumbo, velocidad, distancia, batería, pendiente, potencia y tiempo SIM acelerado ×20. Actualiza datos a 1 Hz sin reconstruir banco/matriz por frame. UTC de captura y segundos SIM se conservan separados.
3. La presión terrestre absoluta `values.surfacePressurePa` y temperatura del aire llegan del backend cuando está disponible. Open-Meteo current es **modelo**, no estación local; se conserva `observedAt`, `fetchedAt`, edad de observación y caché. La consulta API se repite cada 600 s por sitio; backend ausente se reintenta a los 30 s. Caché y archivo nunca generan observaciones meteorológicas nuevas al repetirse proveedor/hora.
4. El aire solo rellena `airK`. Temperatura del equipo, sumidero, área, h y emisividad permanecen desconocidos; Diviner/MCD son productos de superficie archivados/modelados, no valores en vivo del equipo. Luna 0 Pa es vacío ideal; Marte 636 Pa es referencia redondeada, no medición local. Rueda/taladro muestran aplicabilidad y ausencias sin repartir carga uniforme ni inventar instrumentos.
5. Descargá **reporte Excel completo (.xlsx)**. El escritor local genera ZIP/OOXML real sin servicios externos y sin fórmulas ejecutables. Un corte UTC clona candidato, cálculos y sesión antes de preparar el archivo; exporta solo la sesión actual. JSON, Markdown, exportación general y contexto del copiloto conservan la configuración automática aunque el laboratorio manual tenga otras hipótesis.
6. El **laboratorio manual opcional** está cerrado por defecto y permite explorar hipótesis en el banco. Sus cambios no alteran configuración, historia ni reportes de misión. Cerrar el laboratorio recupera el banco automático; cambiar escenario restablece el laboratorio.

Registro en memoria: una muestra rover cada 10 s, máximo 2160 (6 h con seguimiento continuo), 256 observaciones de clima, 500 eventos y 6 sesiones. Volver a seleccionar el mismo escenario conserva la sesión; cambiar escenario o reiniciar explícitamente abre sesión nueva y cierra la anterior con hora/razón; el archivo descarga la sesión actual. Recargar borra sesiones; no hay persistencia prometida. Salir de comparación u ocultar página suspende seguimiento/consultas, cancela peticiones pendientes y deja un evento; volver recupera el seguimiento. La posición/tiempo del escenario se conservan al explorar un sitio independiente y se restauran en pausa al volver, sin mezclar ese recorrido con la historia de misión. Las respuestas atrasadas de otro escenario se descartan mediante token y AbortController. La muestra inicial puede tener pendientes/cargas desconocidas hasta cargar el DEM.

Las 12 hojas son Resumen, Mision, Datos_y_origen, Historial_rover, Historial_clima, Matriz_ruptura, Calibracion, Termica, Herramientas, Recursos_NASA, Fuentes y Limites_eventos. Conservan números como números, unidades por columna, nulos explícitos, fuentes/fechas, ambos modos de carga, procedimientos y límites. Todas llevan filtros, primera fila congelada y anchos legibles. Strings externos se escriben exclusivamente como `inlineStr`, nunca como fórmulas, incluso al empezar con `=`, `+`, `-` o `@`; se escapan XML y controles inválidos. El reporte contiene siete recursos NASA y dos texturas, con papel exclusivamente visual. Ejemplo descargado desde navegador, capturas e informe en [evidencias/m2-automatico](evidencias/m2-automatico/).

## Motor y contrato versionado

- `analog-audit.mjs`: funciones ES puras, sin DOM, red ni estado compartido. Usa `BODY_ENV` de `sim-physics.mjs` y `compareTerrain` de `similarity.mjs`; no duplica física en Python.
- `mission-audit.mjs`: adaptación automática con procedencia por variable y sesiones acotadas; `xlsx-report.mjs`: escritor OOXML local sin dependencias.
- `analog-audit-ui.mjs`: controlador del panel. `mission.js` le entrega escenario, rejillas y telemetría reales, y recoge contexto/exportación. No altera el catálogo de 14 sitios ni los datos de los escenarios.
- `buildCandidateAnalogPayload({scenario, earthGrid, targetGrid, telemetry})` adapta una pareja a `CandidateAnalogPayload` **1.0.0**, conserva métricas, temperaturas superficiales, procedencia, coordenadas y metadatos. No incluye las matrices de elevación para mantener el dossier manejable.
- `validateCandidateAnalogPayload(payload)` devuelve `{valid, errors}`. Comprueba versión, identidad del escenario, unidades, cantidades, rangos y escala; rejillas de otro escenario se rechazan. Telemetría de otro sitio se descarta con advertencia.
- `calibrateEngineering(inputs)` devuelve cálculos estructurados independientes. Números JS finitos, sin coerción de strings/booleanos. Ausentes → `null`; inválidos → error y resultado afectado `null`.
- `auditAnalog(candidate, inputs)` devuelve `AnalogAuditResult` **1.0.0**, `scenarioId`, `candidateVersion`, `matrix`, `counts`, `geometry`, `calibration`, `sources` y `limitations`. Contrato inválido → `valid:false`, errores, matriz vacía y calibración `null`. Inputs inválidos no invalidan la evidencia de la matriz: `calibration.valid:false` impide exportar.
- `createDossier(candidate, audit, exportedAt?)` devuelve una copia aislada `AnalogAuditDossier` **1.0.0** con fecha de exportación, candidato, auditoría y aviso. Rechaza escenarios distintos o entradas inválidas. `dossierMarkdown(dossier)` prepara el informe con evidencias, parámetros, fuentes y límites. Para reproducibilidad puede suministrarse fecha fija; el motor no necesita reloj.

La estructura completa está en [candidate-analog-payload.schema.json](candidate-analog-payload.schema.json). Las extensiones aditivas pueden introducir campos opcionales; los consumidores deben comprobar `schema` y `version`. Cambios incompatibles requieren otra versión. No existe en esta entrega importación de dossiers desde la interfaz: otros módulos pueden importar el motor o consumir el JSON exportado.

```js
import { buildCandidateAnalogPayload, auditAnalog, createDossier, dossierMarkdown } from './analog-audit.mjs';
const candidate = buildCandidateAnalogPayload({ scenario, earthGrid, targetGrid, telemetry });
const audit = auditAnalog(candidate, {
  equipment: 'rover', massKg: 100, targetBody: scenario.body,
  earthPressurePa: null, targetPressurePa: null,
});
const dossier = createDossier(candidate, audit);
const json = JSON.stringify(dossier, null, 2);
const markdown = dossierMarkdown(dossier);
```

El candidato lleva `scenario:{id,title,earthId,targetId,body}`, `earth`, `target` y `adaptationWarnings`. Cada lado incluye identidad, `center`, `environment` descriptivo, `grid`, `metrics`, `gravity`, `pressure`, `airTemperature`, `surfaceTemperature`, `ionizingDoseRate`, `telemetry`, `provenance` y `notes`. Las cantidades individuales usan `{value,unit,kind,source,observedAt}`; sus valores desconocidos son explícitamente `null`. Los tipos incluyen `reference`, `idealization`, `weather-model`, `archive` y `unknown`; el producto superficial conserva su `kind` original (`diviner`/`model`, etc.). La falta de dosis ionizante es `null`, nunca se deduce desde irradiancia solar.

Cada fila de la matriz lleva `{id,label,status,strength,breakdown,action,evidence:[{path,data}]}`. Los IDs actuales son `scale`, `geometry`, `gravity`, `atmosphere`, `pressure`, `temperature`, `heat-transfer`, `radiation` y `regolith`. Los estados son `valid`, `partial`, `breakdown`, `unknown`. No se usan umbrales arbitrarios para convertir el índice geométrico en validación física. La geometría existente queda intacta, con sus pesos editoriales, advertencias de resolución y exclusión dB/CPR.

## Fórmulas, unidades y supuestos

| Magnitud | Fórmula y dominio |
| --- | --- |
| Peso, N | `W = m·g`, masa positiva en kg, gravedad positiva en m/s². |
| Razón de gravedad | `r_g = g_obj/g_Tierra`; ambas gravedades explícitas y positivas. |
| Descarga vertical, N | `F = m·(g_Tierra − g_obj)`, suelo horizontal, soporte vertical cuasiestático y misma masa. Positiva hacia arriba; negativa pide carga adicional. |
| Masa equivalente terrestre, kg | `m_equiv = m·r_g`; iguala únicamente el peso estático. Cambiar masa cambia inercia y no reproduce el equipo original. |
| Presión, Pa | `Δp = p_Tierra − p_obj`; `p_obj/p_Tierra` solo si `p_Tierra>0`, inversa solo si `p_obj>0`. No se genera `Infinity`; una razón que desborde el rango numérico se rechaza con error. |
| Convección del ensayo, W | `Q_conv = h·A·(Ts−Ta)`, con h≥0 en W/m²/K, área positiva en m², temperaturas absolutas positivas en K. h es explícito, no se deriva de presión, viento o gravedad. |
| Radiación térmica del ensayo, W | `Q_rad = ε·σ·A·(Ts⁴−Tentorno⁴)`, ε en [0,1], σ≈5.670374419×10⁻⁸ W/m²/K⁴. Superficie gris isotérmica en recinto negro grande y factor de vista 1. |

Ejemplo de **100 kg**: con g_Tierra=9.81 m/s², peso terrestre=981 N. Luna g=1.62: peso=162 N, descarga=819 N, razón≈0.16514. Marte g=3.71: peso=371 N, descarga=610 N, razón≈0.37819. Estos valores redondeados son compatibles con `BODY_ENV`; 9.81 es la referencia terrestre redondeada del prototipo, no gravedad local medida ni una constante exacta.

Ejemplo térmico hipotético: A=2 m², Ts=300 K, Ta=280 K, h=10 W/m²/K, ε=0.8 y Tentorno=250 K producen Q_conv=400 W y Q_rad≈380.4821 W. Q positiva es pérdida de calor; negativa, ganancia. No se suman como balance completo: faltan conducción, Sol/albedo, disipación interna y transitorios. El cuerpo del selector cambia gravedad y presión de referencia, **no convierte Q en predicción planetaria**. Para convección externa en vacío ideal debe usarse h=0; para Marte hace falta un coeficiente propio y un modelo válido del régimen de gas.

Límites numéricos de la calculadora (validación informática, no límites de diseño): masa (0,10⁷] kg, gravedad [0.001,100] m/s², presión [0,10⁹] Pa, área (0,10⁶] m², temperaturas (0,5000] K, h [0,10⁵] W/m²/K y ε [0,1]. No se aceptan temperaturas Celsius en campos Kelvin ni temperaturas absolutas nulas/negativas.

La descarga no iguala dinámica, inercia, confinamiento del suelo, cohesión, tracción, saltación, excavación o terramecánica. No se ofrecen escalas Froude, velocidad o tiempo sin un modelo dinámico definido. Vacío, química, radiación ionizante y polvo requieren ensayos específicos, no escalares universales. La térmica Diviner/MCD es **superficial**, la meteorología terrestre es **aire**, y el mínimo de Shackleton permanece `null`. Tampoco se infiere hielo, blindaje o cavidades desde DEM/CPR.

## Copiloto y otros módulos

El contexto añade `analogyAudit` con versión, escenario, estados por fila, calibración compacta y límites. La calibración automática incluye cuerpo real del escenario y `kind:"mission-config"`; las hipótesis opcionales del laboratorio no entran en el contexto. No se envían elevaciones ni todo el dossier al LLM. El copiloto por reglas responde a gravedad, peso, presión, vacío, ruptura y calibración sin IA; el prompt opcional del servidor conserva los mismos límites. No se probó ningún proveedor LLM externo y no se necesita para la entrega.

[Recomendaciones para módulos 1, 3, 4 y 5](recomendaciones-modulos.md) describe el estado revisado **antes** de esta integración y propone el siguiente sprint. Sus menciones a `CandidateAnalogPayload` pendiente y a exportación solo JSON de misión son antecedentes: esta entrega ya incorpora el contrato 1.0.0 y dossier local JSON/Markdown del módulo 2. Quedan como propuestas la composición de todos los módulos, descubrimiento automático, radar/subsuelo validado y PDF; las series acotadas de rover y clima M2 ya están implementadas y se incluyen en Excel; no están implementadas aquí.

## Fuentes verificadas

Referencias consultadas el 14 de noviembre de 2026; solo se guardan enlaces y fórmulas/paráfrasis, sin descarga en ejecución:

- [NASA Glenn · Weight Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/weight-equation-2/): distinción masa/peso y W=m·g.
- [NASA NSSDC · Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html), [Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html), [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html): referencias gravitatorias y atmósfera. Marte: 6.36 mbar al radio medio = 636 Pa, variable con estación/altitud; no presión local del objetivo. Vacío lunar cero es idealización explícita, no presión real de exosfera.
- [NASA · Thermal Control](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/): mecanismos y balance térmico, ausencia de convección externa en vacío.
- [NIST CODATA · Stefan–Boltzmann constant](https://physics.nist.gov/cgi-bin/cuu/Value?sigma): valor de σ, consultado directamente (la herramienta web puede alterar el parámetro CGI; se verificó también con HTTP local).
- [NASA · Space Radiation](https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/): entorno de radiación y protección terrestre. No se usan dosis numéricas de referencia.
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs): current es salida de modelo; surface_pressure es presión local y no presión al nivel del mar. El backend convierte hPa a Pa una sola vez.
- La evidencia geoespacial conserva fuentes de los JSON existentes y [targets-sources.md](targets-sources.md). El motor no cambia ni revalida esos productos.

## Verificación

`npm run check` incluye sintaxis del motor, controlador y módulo de misión, y todas las pruebas `node --test`. `tests/analog-audit.test.mjs` cubre Luna/Marte/Tierra, nulos, entradas inválidas, presión cero, signos térmicos, aislamiento de entradas, cuatro adaptaciones reales, contrato, escala, exportación y consumo local del copiloto. Backend existente: `python -m pytest server/tests` en un entorno con `server/requirements-dev.txt`. La evidencia de ejecución y navegador de esta implementación se registra en el informe final; los tests no constituyen validación física experimental ni auditoría de accesibilidad completa.


## Banco visual 3D y explorador NASA

El banco aparece al seleccionar un escenario A.R.E.S. Las fuerzas proceden de `audit.calibration.gravity` y las masas de sus entradas validadas. Una entrada vacía o inválida elimina las flechas y muestra desconocidos; nunca conserva las cargas anteriores. La tarjeta del banco muestra escenario, análogo, objetivo y cuerpo hipotético del ensayo si difiere del objetivo real.

- **Misma masa + soporte vertical:** el equipo conserva masa original e inercia ideal. Se aplica `F = m·(g_Tierra − g_obj)`; la carga residual terrestre es `m·g_obj`. F negativa pide carga adicional. El pórtico y el cable son ilustrativos, sin modelar restricciones reales del soporte.
- **Masa terrestre equivalente:** se ensaya `m_equiv = m_original·g_obj/g_Tierra`, con soporte cero. La masa y el peso originales siguen escritos por separado. Solo iguala peso estático; cambia la inercia, respuesta dinámica y esfuerzos internos. Scarecrow es el antecedente visual de un rover aligerado para Curiosity, sin asignar a la malla una masa medida. El modo selecciona esa referencia por defecto y se puede cambiar.
- Las flechas tienen etiquetas, valores en N y una escala común dentro de cada estado. El plano es terrestre; descargar el vehículo no cambia la gravedad del suelo ni la dinámica granular. No hay equivalencia física global.
- **Rover, rueda o taladro:** el rover usa Perseverance o Scarecrow del manifiesto NASA. Para rueda se representa una rueda y su masa soportada; para taladro se representa un esquema de masa descargada sin corte, empuje activo ni par. Ambos son esquemas originales de Atlas, no modelos NASA de esos equipos.
- **Matriz → visual:** cada nombre de parámetro es un botón. Activa el factor, lleva al banco y enfoca su selector. Gravedad/regolito destacan contactos; térmica destaca superficies; atmósfera/presión/radiación destacan envolventes ilustrativas. El texto explica qué puede calibrarse y qué no suministra la malla. La evidencia y el estado de la fila siguen disponibles.

La colección plegable **Objetos reales. Ensayos con límites.** permite cargar individualmente los siete GLB, con metadatos, créditos y enlaces. LRO explica la relación de LOLA con altimetría y Diviner con térmica sin simular un enlace orbital. Block Island es una escena sintética de obstáculo/muestreo de una roca observada por Opportunity en Meridiani Planum: no representa Jezero, el terreno terrestre ni un obstáculo detectado por Atlas. Apollo 11 conserva la exageración vertical Z×60 de su fuente; está expresamente excluido de pendientes, navegación e índice geométrico.

### Globos y registro geográfico

Luna y Marte usan esferas propias con las texturas oficiales `moon-color` y `mars-color`; **no se asume la orientación cartográfica del GLB**. La imagen equirectangular va de −180° a +180°, norte arriba, 0°E central. En `SphereGeometry`, `u=(lon+180)/360`, `v=(lat+90)/180`. La posición del marcador es `[r·cos(lat)·cos(lon), r·sin(lat), −r·cos(lat)·sin(lon)]`: +X=0°E y +Z=90°O. El contrato de textura y las fuentes oficiales están en [nasa-assets.md](nasa-assets.md#orientación-de-las-texturas-para-globos).

Los cuatro centros se leen directamente de `scenario.target` y sus JSON reales: Marius Hills, Shackleton, Jezero y Valles Marineris/Coprates. Se rechazan IDs, cuerpos y coordenadas inconsistentes; sin coordenadas no se inventa marcador. El mapa equirectangular de referencia permite contrastar el registro del globo con la imagen original; sus botones usan los mismos centros reales. Un marcador visible o su botón accesible abre el escenario A.R.E.S. correspondiente, actualiza su selección e inicia la sesión automática M2. Las texturas solo dan contexto, sin alimentar ciencia. La cobertura global no equivale a DEM métrico del ensayo.

### Separación del motor, carga y exportación

`nasa-visual-math.mjs` contiene proyecciones puras de los dos modos, coordenadas y validación del manifiesto/GLB. `nasa-stage.mjs` reutiliza un renderer por escena montada y GLTFLoader/Three locales. Comprueba disponibilidad, bytes y referencias embebidas; rechaza buffers/imágenes externos. La normalización usa bounding box solo para encuadre, nunca para derivar masa, térmica ni dimensiones científicas. No se necesitan extensiones Blender, Draco ni paquetes runtime nuevos.

Solo se carga el modelo seleccionado después de abrir o alcanzar su escena. Cambiar parámetros conserva renderer/canvas/modelo; cambia indicadores y textos. La carga asíncrona usa cancelación y tokens; al cambiar de modelo se liberan geometrías/materiales/texturas. ResizeObserver reajusta tamaño; IntersectionObserver y visibilidad de documento suspenden cuadros fuera de vista. Se dibuja bajo demanda salvo rotación ambiental activada; esta se detiene con `prefers-reduced-motion`. En `pagehide` se libera el renderer salvo restauración de bfcache.

Los controles se operan con teclado; el canvas acepta flechas, `+`/`−` e `Inicio`. En móvil los controles se apilan y la matriz conserva scroll horizontal local. Fallo de recurso → esquema y error explícito; sin WebGL o con pérdida de contexto → modo estático con fichas, esquema y cálculos accesibles. Los siete GLB no se descargan al inicio.

La exportación de interfaz añade al dossier JSON/misión el campo opcional `visualPresentation:{schema:"AnalogVisualPresentation",version:"1.0.0",mode:"offload"|"equivalent",factor,roverReference,normalizedScale:true,scientificSource:false}`. Markdown añade una nota del modo/factor/referencia. Esta metadata no modifica las entradas/resultados científicos, `CandidateAnalogPayload`, el contexto existente del copiloto ni las APIs del servidor.

El rover del terreno conserva `assets/models/perseverance.glb`: su lógica depende de `Wheels_objs`, yaw, dimensiones y articulaciones originales. El nuevo Perseverance convertido se limita al banco/galería; no se ha certificado como reemplazo cinemático. El modelo original y los cálculos geométricos no se modificaron.

Pruebas de presentación/integridad en `tests/nasa-visual.test.mjs`; aceptación real de navegador reproducible con `python3 scripts/check-nasa-browser.py --page <ID-de-página-Orca>`. Capturas y resultados en [evidencias/nasa-3d](evidencias/nasa-3d/). La vista previa de esta revisión usa `http://localhost:8016`; mantené abierta la terminal del servidor. No se publicaron cambios.
