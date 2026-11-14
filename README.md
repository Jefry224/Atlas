# A.R.E.S. Twin · Analog Atlas

Consola *Mission Control* para comparar análogos terrestres con sitios de la Luna y Marte: globo 3D, terreno real, rover simulado, telemetría terrestre en vivo, índice de similitud geométrica y un copiloto «Flight Director».

**V2.0:** 14 sitios documentales más **4 escenarios gemelos** con elevación real a la misma escala (65×65 nodos cada 37.5 m, ventana de 2.4 km). El ranking del catálogo sigue siendo documental y **el índice de los escenarios es geométrico, no un porcentaje de similitud planetaria**.

Prototipo independiente para el [reto de NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/). No implica afiliación ni aprobación de NASA.

## Escenarios A.R.E.S.

| Escenario | Tierra (DEM · imagen · radar) | Objetivo (DEM · térmica) | Índice geométrico |
| --- | --- | --- | --- |
| Tubo de lava | Lanzarote · GLO-30 · S2 L2A · S1 RTC | Marius Hills · Kaguya TC 33 m · Diviner | 25 |
| Cráter polar en sombra | Wright Valley · GLO-30 · S2 L2A · S1 RTC (HH) | Shackleton · LOLA 5 m · Diviner + Mini-RF | 59 |
| Planicie hiperárida | Atacama · GLO-30 · S2 L2A · S1 RTC | Jezero · HiRISE 1 m · Mars Climate Database (modelo) | 40 |
| Cañón eólico | Wadi Rum · GLO-30 · S2 L2A · S1 RTC | Valles Marineris (Coprates) · CTX 20 m · MCD (modelo) | 59 |

El índice (0–100) combina pendiente p50 (0.30), pendiente p90 (0.25), desnivel p95–p5 (0.20) y TRI medio (0.15) con `100·menor/mayor` por componente; la rugosidad (0.10) solo entra si ambos lados la miden en la misma unidad. Detalle en `similarity.mjs`, fuentes en [docs/targets-sources.md](docs/targets-sources.md) y contratos en [docs/contracts.md](docs/contracts.md).

## Abrir la demo

**Sin servidor** (GitHub Pages o local): `python3 -m http.server 8000` y abrí [localhost:8000](http://localhost:8000). Todo funciona; la telemetría usa la lectura archivada (`assets/data/telemetry-snapshot.json`, rotulada ARCHIVO) y el copiloto responde con reglas locales.

**Con servidor** (telemetría en vivo y copiloto con IA):

```bash
cp .env.example .env          # opcional: Meteomatics, Gemini o Anthropic
.venv-server/bin/uvicorn server.main:app --reload --port 8000 --env-file .env
```

Sin claves, el clima en vivo viene de Open-Meteo y el copiloto usa reglas locales. Instalación del entorno, Docker, Cloud Run y dominio: [server/README.md](server/README.md).

1. **Explorador:** elegí un perfil y un sitio, «Iniciar misión» y conducí el rover (WASD o el pad; modo autónomo por defecto).
2. **Escenarios A.R.E.S.:** elegí un escenario para ver Tierra | Objetivo lado a lado con la misma cámara. Abajo: telemetría comparada, física del rover, índice geométrico y Flight Director.

## Datos y regeneración

| Script | Qué genera | Fuentes |
| --- | --- | --- |
| `scripts/fetch-terrain.py` | DEM 9×9 + imagen de los 14 sitios | Copernicus GLO-90 (Open-Meteo), EOxCloudless 2024 |
| `scripts/fetch-scenarios-earth.py` | `assets/data/scenarios/earth/*` | Planetary Computer STAC: cop-dem-glo-30, sentinel-2-l2a, sentinel-1-rtc |
| `scripts/fetch-targets.py` | `assets/data/scenarios/targets/*` | PGDA LOLA, USGS Astrogeology (Kaguya TC, HiRISE, CTX), PDS Diviner y Mini-RF, Mars Climate Database |
| `python -m server.snapshot` | `assets/data/telemetry-snapshot.json` | Open-Meteo |

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
- [Auditoría documental de los 14 sitios](docs/source-audit.md), con fuentes contrastadas, disponibilidad y límites pendientes.

## Fuentes y atribución

Las fuentes institucionales y publicaciones de cada lugar están en `data.js` y visibles en la ficha. Las cuatro ilustraciones de terreno son SVG originales creados para la interfaz. Resumen categorías del catálogo; no representan geometría medida ni fotografías de los lugares. Las barras codifican únicamente puntos documentales.

La geometría del mapa utiliza [Natural Earth, 1:110m land](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/), dominio público, en proyección equirectangular. No se sirven mapas ni imágenes de terceros en tiempo real.

Cada dataset conserva sus propios términos, créditos y requisitos de atribución, registrados en cada JSON (`provenance`, `imagery.credit`, `license`).

## Comprobaciones

```bash
npm run check                                   # 44 pruebas JS: catálogo, rover, física, similitud, copiloto local
.venv-server/bin/python -m pytest server/tests  # 53 pruebas del backend, sin red
```

Los arneses no sustituyen revisión visual ni evaluación de accesibilidad completa. Consultá el [informe de QA](docs/qa.md).

## Archivos

- `index.html`, `styles.css`, `mission.js`: consola Mission Control. `catalog.html`, `catalog.css`, `app.js`, `data.js`: catálogo documental.
- `mission-math.mjs`, `sim-physics.mjs`, `similarity.mjs`, `copilot-rules.mjs`: lógica pura con pruebas en `tests/`.
- `server/`: FastAPI (telemetría, copiloto, estáticos), `Dockerfile`, `scripts/deploy-cloudrun.sh`.
- `assets/data/`: DEM, imágenes, escenarios y lectura archivada. `assets/vendor/`: Three.js con su licencia.
- `docs/`: contratos, fuentes, auditoría, QA, pitch y guion de demo.

## Límites

- Simulación exploratoria, no gemelo digital validado. El rover es cinemático y su energía usa supuestos documentados en `sim-physics.mjs`.
- Ventanas de 2.4 km: no resuelven rocas ni obstáculos a escala de rover. El pozo de Marius Hills (~65 m) no se resuelve a 37.5 m; el LDEM de LOLA está muy interpolado.
- La térmica de Marte es de modelo (MCD); la de Shackleton no tiene mínimo en el producto usado. La rugosidad terrestre (dB) y la lunar (CPR) no se comparan entre sí.
- El centro de Wadi Rum es elección del equipo, no un punto de ensayo publicado.
