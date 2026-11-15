# NASA 3D y banco M2 · verificación integrada local

14 de noviembre de 2026. Vista previa: **http://localhost:8016**; servidor estático en la terminal Orca `term_c7011eb1-af03-496a-aeed-8cd78bc8a2f2`, que debe permanecer abierta. El servidor no abre el navegador automáticamente. No se hicieron commits, staging, push ni deploy.

- **63/63 pruebas JS** con `npm run check`, incluidas las 56 existentes y 7 de presentación/coordenadas/contrato/integridad GLB. [Salida completa](evidencias/nasa-3d/js-check.txt).
- **13/13 regresiones M2 en navegador real Orca**, conservando matriz, cálculo, cambio de cuatro escenarios, exportadores JSON/Markdown/misión, copiloto de reglas y móvil. [Resultados](evidencias/nasa-3d/module2-regression.json).
- **31/31 pruebas nuevas de navegador**: dos modos, originales/equivalentes, errores/vacíos sin carga anterior, rueda/taladro esquemáticos, factores, renderer persistente, cámara por teclado, exportación de presentación, fallo de recurso/reintento, siete GLB reales, ambos globos, selección de escenarios, móvil 390 y fallback WebGL. [Resultados](evidencias/nasa-3d/browser-results.json); reproducción: `python3 scripts/check-nasa-browser.py --page <ID-Orca>`.
- **11/11 comprobaciones adicionales** de ciclo de vida e integración: rotación opt-in, suspensión fuera de vista, reanudación, modo por demanda, movimiento reducido, Q térmica real sobre superficies, descarte de cargas antiguas, registro mapa/globo, raycast del marcador 3D, objetivo polar y Coprates. [Resultados y limitación del runtime](evidencias/nasa-3d/lifecycle-results.json); reproducción: `python3 scripts/check-nasa-lifecycle.py --page <ID-Orca>`.
- Las capturas se revisaron visualmente a **1440×1000** y **390×844**. Sin scroll horizontal global a 390 px; la matriz conserva scroll local. [Banco Luna](evidencias/nasa-3d/bench-luna-desktop.png), [Scarecrow / masa equivalente](evidencias/nasa-3d/bench-scarecrow-desktop.png), [banco móvil](evidencias/nasa-3d/bench-mobile-scene.png), [globo lunar](evidencias/nasa-3d/globe-moon-desktop.png), [globo marciano](evidencias/nasa-3d/globe-mars-desktop.png), [fallback estático](evidencias/nasa-3d/bench-static-mobile.png).
- Siete modelos cargados con **Three/GLTFLoader locales**, con atribución visible. [LRO](evidencias/nasa-3d/gallery-lro-desktop.png), [Block Island sintético](evidencias/nasa-3d/gallery-block-island-desktop.png) y [Apollo 11 Z×60](evidencias/nasa-3d/gallery-apollo-11-desktop.png). Todos los GLB/ambas texturas disponibles e íntegros por SHA256; no se cargan los siete al inicio. [Red de assets](evidencias/nasa-3d/asset-network.json): captura completa de 847 peticiones, 70 de recursos NASA/vendor y cero respuestas fallidas en esos recursos; sin peticiones externas para modelos/texturas NASA. La captura de consola de la prueba funcional no muestra errores; solo el log esperado de la pérdida de contexto inyectada.

`document.hidden` permanece `false` al cambiar de pestaña en este runtime Orca y es de solo lectura, por lo que no se pudo verificar el evento nativo de ocultación de documento. La implementación sí escucha `visibilitychange`, comprueba `document.hidden` y cancela RAF; la suspensión por intersección y la ausencia de cuadros en modo estático se verificaron realmente. La preferencia de movimiento reducido se ensayó con un MediaQueryList de prueba durante el montaje, sin cambiar preferencias del usuario. No se ensayaron dispositivos físicos ni lectores de pantalla. Backend sin cambios de código/API/contrato de servidor en esta tarea: se conserva la verificación previa de 53 pruebas y no se declara una nueva ejecución backend.

Informe de implementación: [nasa-3d/implementation-report.md](evidencias/nasa-3d/implementation-report.md). Fuentes, conversiones y avisos Khronos del worker de assets: [nasa-assets.md](nasa-assets.md). Los modelos no suministran masas, térmica, topografía métrica ni equivalencia física global; el rover original y el índice geométrico siguen intactos.

---

# Verificación de A.R.E.S. Twin V2.0

Fecha: 14 de noviembre de 2026. Integración de los cinco frentes descritos en [contracts.md](contracts.md).

- `npm run check`: **44 pruebas aprobadas, 0 fallos** (catálogo, `mission-math`, `sim-physics`, `similarity`, `copilot-rules`).
- `pytest server/tests`: **53 aprobadas**, sin red (proveedores simulados).
- Datos: los 8 JSON de escenario tienen 4225 elevaciones finitas, imagen existente y métricas que se reproducen al recalcularlas con `terrain_metrics.py` (diferencia < 0.05).
- Servidor local (`uvicorn server.main:app`): `/api/health` ok, `/api/telemetry` en vivo vía Open-Meteo, `/api/copilot` 503 sin clave → reglas locales.
- Chrome headless (1440 px) contra el servidor: los 4 escenarios cargan en vista dividida, el Flight Director responde con reglas locales, **0 excepciones JS, 0 respuestas HTTP ≥ 400**, sin scroll horizontal. Captura revisada del escenario polar (Wright Valley ↔ Shackleton).
- El Frente 4 comprobó además 320, 390 y 980 px sin desbordamiento, en modo estático y con backend.

No verificado: copiloto con Gemini/Anthropic real ni Meteomatics real (sin credenciales; solo con mocks), despliegue en Cloud Run y dominio, dispositivos táctiles físicos, lectores de pantalla.

---

# Verificación de Analog Atlas V1

Fecha: 14 de noviembre de 2026.

## Resultado local

`npm run check`: **10 pruebas aprobadas; 0 fallos**. Se ejecutaron además `node --check app.js` y `node --check data.js`.

Comprobado de forma automatizada:

- 14 registros con IDs únicos, coordenadas numéricas acotadas y fuentes HTTPS.
- Tres perfiles; criterios sin duplicados y pesos positivos que suman 100.
- Puntajes reproducibles y contribuciones reconciliadas; etiquetas faltantes no suman puntos.
- Desempates por evidencia del perfil y nombre; el resultado no depende del orden de entrada.
- Ejemplos: Merzouga/Dumont, Black Point y Atacama/ARADS conservan su evidencia del perfil.
- Pampa de La Joya no recibe los 55 puntos de hiper-aridez sin soporte puntual.
- En DOM simulado: 14 marcadores y 14 entradas para cada perfil; selección de cada sitio desde ambos controles mantiene sincronizados el detalle y `aria-pressed`.
- En DOM simulado: cambios de perfil y selecciones repetidas no duplican entradas ni selecciones activas.
- Recursos locales, destinos de anclas, aviso de alcance, alternativa sin JavaScript y reglas de foco/movimiento reducido presentes.

La auditoría documental está en [source-audit.md](source-audit.md). Los límites de coordenadas y de evidencia se indican explícitamente; no se ha hecho una auditoría geoespacial del catálogo completo.

## Revisión visual y de interacción completada

La revisión V1.1 se abrió desde un servidor temporal en la terminal de la misma PC visible que usa Chromium. Los intentos previos desde el ejecutor aislado no eran accesibles al navegador; esa limitación quedó resuelta para esta revisión.

- **Escritorio:** interfaz inspeccionada visualmente a 1165 px de ancho útil. Mapa central, controles compactos, ilustración conceptual y detalles plegados. `clientWidth` y `scrollWidth` coinciden: sin desbordamiento horizontal.
- **Flujo real de los tres perfiles:** Merzouga desde la lista, Black Point desde el mapa activado con Enter y Atacama/ARADS desde el listado. Ficha, marcador y fila seleccionada quedaron sincronizados.
- **Teclado:** la activación de Black Point con Enter mostró foco visible de contorno sólido. Los desplegables se abrieron con clic y cerraron con Enter.
- **Responsive:** `tests/responsive-preview.html` carga la app real dentro de marcos de 390 × 844 y 320 × 568 px. Se revisaron ambos visualmente y se comprobó que el ancho desplazable coincide con el útil. La barra de desplazamiento consume 15 px en este Chromium, por lo que el contenido mide 375 y 305 px respectivamente. Tras el ajuste final, el mapa ocupa de y=318 a 488 px en el marco de 390 px, y de y=338 a 477 px en el de 320 px: aparece completo dentro de la primera pantalla. Se seleccionó Wright Valley desde el final del listado móvil; ficha, marcador e ilustración se actualizaron correctamente y sus fuentes se desplegaron sin desbordamiento.
- **Gráficos:** las ilustraciones locales se muestran y están rotuladas como conceptuales, no fotografías. La barra segmentada distingue criterios documentados de criterios sin dato con trama, además del texto.

Esta comprobación de viewport **no simula un teléfono físico, su agente de usuario ni la entrada táctil**. No es una certificación WCAG ni una prueba completa con lectores de pantalla. No se midieron rendimiento de red ni Core Web Vitals. La verificación exhaustiva de 14 sitios × 3 perfiles sigue cubierta por el arnés automatizado; en navegador se realizaron los ejemplos descritos, no una segunda pasada exhaustiva de todas las combinaciones.

Las fuentes y los 14 registros de `data.js` no se modificaron en esta revisión visual. Las puntuaciones y pesos siguen siendo los mismos.

## Publicación

La verificación del repositorio público, commit remoto, GitHub Pages y sus recursos depende del entorno de publicación. Este informe local no acredita esos pasos. Completar aquí o en la entrega el enlace y hash realmente verificados.

## M2 automático: misión, series y Excel (14 noviembre 2026)

La evidencia de esta evolución está en [evidencias/m2-automatico](evidencias/m2-automatico/), separada de los ensayos NASA previos que usaban calculadora manual como flujo principal. `npm run check` ejecuta 71 pruebas JS; backend informó 135 pruebas propias sin red. `scripts/check-m2-browser.py` verifica 20 casos adaptados al flujo automático y `scripts/check-m2-refresh.py` añade 6 sobre fallback estático, reintento, TTL, deduplicación y ciclo de página; `scripts/check-m2-view-session.py` verifica otros 6 sobre separación del recorrido de sitio, reselección, reinicio y catálogo (32 checks GUI en total). Los mocks solo se usan en las fases rotuladas MOCK; las capturas principales y el Excel ejemplo usan la API real Open-Meteo. No se verifica un LLM externo.

Validación independiente: instalar openpyxl en un entorno aislado y ejecutar `scripts/validate-m2-xlsx.py`. Comprueba las 12 hojas del XLSX descargado, pesos y ambos modos, números, historia, presión superficial, nulos, fuentes, filtros, freeze y cadenas externas sin fórmulas (fixture explícito separado). El runtime Orca no permite redefinir `document.hidden` ni ofrece un cambio de visibilidad nativo verificable en este entorno; la rama oculta está revisada en código, mientras que el evento de recuperación visible y pagehide sí se ejercitan. No se declara una prueba nativa de suspensión oculta.
