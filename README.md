# A.R.E.S. Twin · Analog Atlas

Consola *Mission Control* para comparar análogos terrestres con sitios de la Luna y Marte: globo 3D, terreno real, rover simulado, telemetría terrestre en vivo, índice de similitud geométrica y un copiloto «Flight Director».

**V2.0:** 14 sitios documentales más **4 escenarios gemelos** con elevación real a la misma escala (65×65 nodos cada 37.5 m, ventana de 2.4 km). El ranking del catálogo sigue siendo documental y **el índice de los escenarios es geométrico, no un porcentaje de similitud planetaria**.

Prototipo independiente para el [reto de NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/). No implica afiliación ni aprobación de NASA.

## Escenarios A.R.E.S.

| Escenario | Tierra (DEM · imagen · radar) | Objetivo (DEM · térmica) | Índice geométrico |
| --- | --- | --- | --- |
| Tubo de lava | La Corona (Lanzarote) · GLO-30 · S2 L2A · S1 RTC | Marius Hills · Kaguya TC 33 m · Diviner | 72 |
| Cráter polar en sombra | Wright Valley · GLO-30 · S2 L2A · S1 RTC (HH) | Shackleton · LOLA 5 m · Diviner + Mini-RF | 97 |
| Planicie hiperárida | Atacama · GLO-30 · S2 L2A · S1 RTC | Jezero · HiRISE 1 m · Mars Climate Database (modelo) | 82 |
| Cañón eólico | Wadi Rum · GLO-30 · S2 L2A · S1 RTC | Valles Marineris (Coprates) · CTX 20 m · MCD (modelo) | 83 |

El índice (0–100) combina pendiente p50 (0.30), pendiente p90 (0.25), desnivel p95–p5 (0.20) y TRI medio (0.15) con `100·menor/mayor` por componente; la rugosidad (0.10) solo entra si ambos lados la miden en la misma unidad. Los centros terrestres se eligen con `scripts/analog_match.py` (misma receta, §1.1 de los contratos). Detalle en `similarity.mjs`, fuentes en [docs/targets-sources.md](docs/targets-sources.md) y contratos en [docs/contracts.md](docs/contracts.md).

## Abrir la demo

**Un comando para API y web**, desde `Atlas`:

```bash
npm run dev
```

Abrí [localhost:8000](http://localhost:8000). La misma instancia sirve la web, [API](http://localhost:8000/api/health) y [documentación interactiva](http://localhost:8000/api/docs); no hace falta levantar un frontend aparte. Desde la carpeta padre también podés usar `npm --prefix Atlas run dev`.

El launcher prepara `.venv-server` e instala los requisitos existentes si faltan dependencias (requiere conexión en esa primera preparación), carga `.env` si existe y activa recarga del backend. No requiere claves: usa Open-Meteo y copiloto con reglas locales. Dejá la terminal abierta; `Ctrl+C` detiene todo. Para otro puerto: `npm run dev -- --port 8027`. `npm start` levanta ambos sin recarga. También acepta `ATLAS_PYTHON`. Proveedores opcionales, Docker y alojamiento: [server/README.md](server/README.md).

**Modo estático sin API:** `npm run start:static -- 8028`, [localhost:8028](http://localhost:8028). El clima procede de archivo y conserva su fecha; no se rotula actual. Los cálculos y Excel funcionan localmente.

1. **Explorador:** elegí un perfil y un sitio, «Iniciar misión» y conducí el rover (WASD o el pad; modo autónomo por defecto).
2. **Escenarios A.R.E.S.:** elegí un escenario para ver Tierra | Objetivo lado a lado con la misma cámara. Abajo: telemetría comparada, física del rover, índice geométrico y Flight Director.
3. **Módulo 2 · Seguimiento automático:** elegí escenario sin rellenar campos; la configuración compartida del prototipo (350 kg) y las fuentes del escenario alimentan banco 3D, matriz y calibración. Iniciá rover para registrar muestras cada 10 s; descarga Excel real de 12 hojas con historia, herramientas, procedencia y límites, además de JSON/Markdown. El laboratorio manual opcional está aislado del reporte. [Uso, fórmulas y límites](docs/modulo-2.md).
4. **Transmisión del rover:** botón ⛶ (o tecla F) en la vista 3D: pantalla completa con estética de cámara de rover, cámaras Persecución / Mástil / Orbital (tecla C), rumbo, horizonte artificial y telemetría. Es una **transmisión simulada**: no hay enlace real con ningún rover.
5. **Procesos activos · ventana de pruebas 72 h (Módulo 3):** en modo escenario, el panel 09 cruza el pronóstico horario (Meteomatics o Open-Meteo) con la curva diurna del objetivo (LRO Diviner o Mars Climate Database) y marca a qué hora local el análogo replica la **forma** del calentamiento o enfriamiento, cuándo hay **saltación** de arena (el proceso de las tormentas de polvo marcianas) y cruces de **congelamiento** rápido; suma 12 meses de cambio superficial con radar Sentinel-1. Temperaturas absolutas e intensidades no coinciden: se compara forma, fase y proceso.

## Banco 3D y colección NASA

Al elegir un escenario, el banco M2 conecta las flechas de peso Tierra/objetivo/soporte con la configuración automática de misión y sus referencias. Conserva masa original y masa del ensayo por separado; la masa reducida cambia la inercia. Rueda y taladro tienen esquemas explícitos de Atlas. Los modelos nunca aportan parámetros científicos.

**Explorar modelos y objetivos de la Luna y Marte**, debajo de M2, abre siete recursos locales con ficha y atribución: Scarecrow, Perseverance, Luna, Marte, LRO, Block Island y Apollo 11. Los globos cartográficos usan texturas oficiales equirectangulares separadas de los GLB; sus marcadores abren los cuatro escenarios existentes. El terreno Apollo 11 lleva Z×60 y se excluye de pendientes; Block Island es una escena sintética independiente de Jezero/Tierra.

Arrastrá la escena o usá flechas, `+`/`−` e `Inicio` sobre su canvas enfocado. La rotación ambiental es opcional y respeta movimiento reducido. Los modelos se cargan bajo demanda; ante fallos hay esquemas/fichas y valores accesibles. [Uso y límites M2](docs/modulo-2.md#banco-visual-3d-y-explorador-nasa), [preparación y créditos de assets](docs/nasa-assets.md), [evidencia visual](docs/evidencias/nasa-3d/).

Vista previa M2 con backend: [localhost:8027](http://localhost:8027), comando `npm start -- --port 8027` desde `Atlas`. La vista previa estática anterior en 8016 se conserva. Dejá abierta la terminal del servidor mientras revisás. [Excel real y evidencia](docs/evidencias/m2-automatico/).

## Datos y regeneración

| Script | Qué genera | Fuentes |
| --- | --- | --- |
| `scripts/fetch-terrain.py` | DEM 9×9 + imagen de los 14 sitios | Copernicus GLO-90 (Open-Meteo), EOxCloudless 2024 |
| `scripts/fetch-scenarios-earth.py` | `assets/data/scenarios/earth/*` | Planetary Computer STAC: cop-dem-glo-30, sentinel-2-l2a, sentinel-1-rtc |
| `scripts/fetch-targets.py` | `assets/data/scenarios/targets/*` | PGDA LOLA, USGS Astrogeology (Kaguya TC, HiRISE, CTX), PDS Diviner y Mini-RF, Mars Climate Database |
| `python -m server.snapshot` | `assets/data/telemetry-snapshot.json` | Open-Meteo |
| `python -m server.forecast_snapshot` | `assets/data/processes-forecast-snapshot.json` (72 h por sitio) | Open-Meteo |
| `scripts/fetch-process-history.py` | `assets/data/processes/*` (Sentinel-1, 12 meses) | Planetary Computer sentinel-1-rtc, Open-Meteo Archive |

Las métricas de terreno se calculan siempre con `scripts/terrain_metrics.py`. Los entornos `.venv-*` no se versionan.

## Cómo se calcula

| Perfil | Criterios y pesos |
| --- | --- |
| Marte · Dunas | Campo de dunas (50), entorno seco (20), dunas en media luna (20), pruebas de movilidad (10) |
| Luna · Terreno rocoso | Superficie rocosa (35), relieve irregular (30), terreno volcánico (15), ensayo con sombras largas (15), entorno seco (5) |
| Marte · Muestreo | Hiperaridez documentada (55), entorno seco (15), perforación documentada (30) |

Para cada sitio se suman los pesos de las etiquetas registradas. Un criterio sin dato en la ficha suma cero, **sin afirmar que el atributo esté ausente**. Los empates priorizan un antecedente del perfil y luego el nombre, con ordenación española. No hay aleatoriedad. La configuración está al principio de `app.js`; `createRanking` y `readCriteria` son las mismas funciones usadas por la interfaz y los tests.

Los pesos son decisiones del prototipo, no parámetros calibrados frente a Marte o la Luna. Los antecedentes influyen en este ranking documental. En una futura comparación geométrica deberán mostrarse por separado, sin favorecer un lugar por su prestigio. «Rocoso» e «irregular» son descripciones cualitativas, no mediciones comparables de bloques, rugosidad o pendiente.

## Evidencia y límites

- Las fichas distinguen antecedentes documentados de candidatos propuestos para evaluación. Un antecedente puede ser robótica, formación humana o una comparación científica; la ficha especifica cuál.
- Las coordenadas sitúan regiones de interés y no son polígonos de ensayo. Salvo indicación de una fuente puntual, no se han revalidado cartográficamente. La evidencia de Haughton para operaciones lunares es del cráter, no necesariamente del punto Drill Hill.
- La hiper-aridez de Pampas de La Joya está documentada en sectores regionales, pero no se otorgan esos puntos al marcador dunar sin demostrar su coincidencia con el sector estudiado.
- La muestra no es exhaustiva ni demuestra que un sitio sea accesible o seguro. Son necesarias mediciones a la escala del ensayo, permisos, evaluación ambiental y comprobación de campo.
- El relieve terrestre no reproduce por sí solo la gravedad, iluminación, regolito, atmósfera, química o biología de otro mundo.
- [Siguiente sprint de módulos 1, 3, 4 y 5](docs/recomendaciones-modulos.md); contexto previo y alcance actualizado en [Módulo 2](docs/modulo-2.md#copiloto-y-otros-módulos).
- [Auditoría documental de los 14 sitios](docs/source-audit.md), con fuentes contrastadas, disponibilidad y límites pendientes.

## Fuentes y atribución

Las fuentes institucionales y publicaciones de cada lugar están en `data.js` y visibles en la ficha. Las cuatro ilustraciones de terreno son SVG originales creados para la interfaz. Resumen categorías del catálogo; no representan geometría medida ni fotografías de los lugares. Las barras codifican únicamente puntos documentales.

La geometría del mapa utiliza [Natural Earth, 1:110m land](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/), dominio público, en proyección equirectangular. No se sirven mapas ni imágenes de terceros en tiempo real.

El rover del terreno es el [modelo 3D oficial de Perseverance](https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/) (NASA/JPL-Caltech, `assets/models/perseverance.glb`, 11.7 MB), cargado solo al abrir la vista de terreno; mientras tanto, o si falla, se usa un rover esquemático.

Cada dataset conserva sus propios términos, créditos y requisitos de atribución, registrados en cada JSON (`provenance`, `imagery.credit`, `license`).

## Comprobaciones

```bash
npm run check                                   # 109 pruebas JS: catálogo, rover, física, similitud, copiloto y auditoría local
.venv-server/bin/python -m pytest server/tests  # 142 pruebas del backend, sin red
```

Los arneses no sustituyen revisión visual ni evaluación de accesibilidad completa. Consultá el [informe de QA](docs/qa.md).

## Archivos

- `index.html`, `styles.css`, `mission.js`: consola Mission Control. `app.js`, `data.js`: motor de ranking documental y los 14 sitios.
- `nasa-visual-math.mjs`, `nasa-stage.mjs`, `nasa-bench.mjs`, `nasa-explorer.mjs`: proyección de carga, loader local, banco y galería/globos, separados del motor científico.
- `rover-config.mjs`, `mission-audit.mjs`, `xlsx-report.mjs`: configuración compartida, sesiones y Excel OOXML local.
- `analog-audit.mjs`, `analog-audit-ui.mjs`: auditoría y calibración del módulo 2; contrato, exportación y fuentes en [docs/modulo-2.md](docs/modulo-2.md).
- `mission-math.mjs`, `sim-physics.mjs`, `similarity.mjs`, `copilot-rules.mjs`: lógica pura con pruebas en `tests/`.
- `processes.mjs`, `weather-sim.mjs`, `solar.mjs`, `scene-fx.mjs`: procesos de 72 h, clima, posición solar y presentación 3D de la escena.
- `server/`: FastAPI (telemetría, copiloto, estáticos), `Dockerfile`, `scripts/deploy-cloudrun.sh`.
- `assets/data/`: DEM, imágenes, escenarios y lectura archivada. `assets/vendor/`: Three.js con su licencia.
- `docs/`: contratos, fuentes, auditoría, QA, pitch y guion de demo.

## Límites

- Simulación exploratoria, no gemelo digital validado. El rover es cinemático y su energía usa supuestos documentados en `sim-physics.mjs`.
- Ventanas de 2.4 km: no resuelven rocas ni obstáculos a escala de rover. El pozo de Marius Hills (~65 m) no se resuelve a 37.5 m; el LDEM de LOLA está muy interpolado.
- La térmica de Marte es de modelo (MCD); la de Shackleton no tiene mínimo en el producto usado. La rugosidad terrestre (dB) y la lunar (CPR) no se comparan entre sí.
- El centro de Wadi Rum es elección del equipo, no un punto de ensayo publicado.

El Excel del módulo 2 usa un dossier Mission Control con gráfico nativo, ocho herramientas base por misión y valores base separados de observaciones. Ver [ejemplos descargables y revisión visual](docs/evidencias/m2-excel-diseno/index.html) y [perfiles propuestos](docs/perfiles-base-m2.md). Preview local: `http://localhost:8027/`; desde Atlas se inicia con `npm start -- --port 8027`.

## Descenso final 3D y exploración desde contacto

Los cuatro escenarios A.R.E.S. comienzan por **elegir destino lunar o marciano → preparar misión (Zona del destino / Carga y resumen) → confirmar preparación → iniciar descenso → revisar y autorizar → explorar con rover espejo**. La preparación es un diálogo sobre el visor: confirmar habilita el inicio, sin arrancar; cerrar/Escape no confirma. Editar zona/carga, reiniciar o cambiar escenario exige nueva confirmación. Cámara, tasa y comparación conservan la confirmación. El gate central cubre CTA, play, visor, teclado y transmisión; sin candidato válido no se fuerza el vuelo y 0 % es un ensayo deliberado con aviso. Hay un solo mapa y combustible de aterrizaje, del destino. Tierra es referencia opcional, sin segunda nave ni segundo contacto; tras desplegar conserva el **Rover de ensayo** como autoridad y el destino muestra **Rover espejo · simulado**, sincronizado por desplazamiento relativo desde sus orígenes propios. Cada DEM evalúa su suelo; no se copian coordenadas absolutas ni existe enlace con hardware. Si falta origen Earth, el destino puede aterrizar pero el espejo queda desactivado con explicación. Fallo target retiene el rover. Vuelo **1× SIM por defecto**, velocidades 0,5×/1×/2×/4× y autorización **manual** tras contacto; rover SIM ×20. Cámara, pausa, reinicio, clima terrestre modelado y registro M2 conservan sus funciones e identidad de sesión.

Todo se ejecuta localmente con los comandos de inicio anteriores. [Guía de uso y validación](docs/descenso-uso.md) · [Modelo, límites y fuentes](docs/descenso-modelo.md) · [Evidencias de misión al destino](docs/evidencias/mision-destino/informe.md) · [Preparación, pruebas y rendimiento medido](docs/evidencias/preparacion-rendimiento/informe.md). El catálogo terrestre conserva exploración directa con rover. Los DEM regionales no certifican terreno ni resuelven patas, rocas o cavidades; Marte representa solo el tramo propulsado final idealizado, sin entrada ni paracaídas.
