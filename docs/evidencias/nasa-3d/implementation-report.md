# Entrega local · experiencia NASA 3D y banco M2

Implementación completa en `/home/jefry/dev/personal/S.E.L.E.N.E/Atlas`, 14 de noviembre de 2026. Sin commits, staging, push ni deploy. Los cambios M2 y demás archivos ajenos se conservaron.

## Resultado revisable

Preview **http://localhost:8016**, abierto en la página Orca `10b98d99-d076-4c84-be0a-a808391fc904`. Servidor activo en la terminal visible **Atlas NASA preview 8016**, handle `term_c7011eb1-af03-496a-aeed-8cd78bc8a2f2`. Dejar esa terminal abierta; si se cierra, desde Atlas ejecutar `python3 -m http.server 8016 --bind 0.0.0.0` y abrir la URL manualmente. La vista queda en el banco del escenario Marte/Atacama–Jezero.

Banco con misma masa y soporte de descarga, o masa terrestre equivalente que iguala únicamente peso estático. Flechas 3D rotuladas y tarjetas numéricas proceden de la calibración real; masa original y masa del ensayo permanecen separadas. Los errores/vacíos eliminan cargas anteriores. Seleccionar parámetro en la matriz resalta contactos, superficies o envolvente y explica sus límites; las superficies también muestran Q_conv/Q_rad y área actuales. Rueda/taladro son esquemas explícitos de Atlas.

Galería lazy con siete GLB reales, sus fichas, procedencia y términos; globos cartográficos propios con dos texturas oficiales registradas equirectangularmente, mapa 2D independiente y cuatro centros leídos de los JSON reales. Click sobre marcador 3D, mapa o botón abre el escenario existente. LRO explica LOLA/Diviner; Block Island se presenta como ejemplo sintético separado de Jezero/Tierra; Apollo 11 advierte Z×60 y se excluye del cálculo DEM.

Renderers persistentes, dibujo por demanda, rotación opcional, suspensión por intersección/visibilidad, resize, cancelación/tokens de carga y liberación de recursos. Controles por teclado, movimiento reducido, diseño móvil sin overflow global, fallback de red/WebGL con fichas y valores accesibles. JSON de dossier/misión añade metadata opcional de presentación; Markdown añade una nota del modo. Copiloto y contratos de servidor permanecen vigentes.

## Evidencia

- `npm run check`: **63/63**, en [js-check.txt](js-check.txt).
- Regresión previa M2 en navegador: **13/13**, [module2-regression.json](module2-regression.json).
- Aceptación NASA/banco en navegador real: **31/31**, [browser-results.json](browser-results.json).
- Ciclo de vida, Q, cargas antiguas y marcadores adicionales: **11/11**, [lifecycle-results.json](lifecycle-results.json). Una comprobación nativa de ocultación de documento no está disponible en Orca: `document.hidden` no cambia al cambiar de pestaña; la limitación está registrada, sin marcarla aprobada.
- **7/7 GLB** cargados por GLTFLoader local y **2/2 texturas** oficiales en globos registrados; manifiesto y archivos pasan comprobación de bytes/SHA256 y recursos embebidos. Khronos sin errores según entrega del worker assets.
- [asset-network.json](asset-network.json): traza completa de 847 peticiones, 70 NASA/vendor, cero respuestas fallidas para esos assets y sin solicitudes externas de modelos/texturas NASA. [browser-console.json](browser-console.json): ningún error; log esperado al inyectar pérdida de contexto.
- Escritorio 1440×1000 y móvil 390×844: capturas revisadas visualmente. [Luna/banco](bench-luna-desktop.png), [Scarecrow/equivalente](bench-scarecrow-desktop.png), [móvil/escena](bench-mobile-scene.png), [Luna/globo](globe-moon-desktop.png), [Marte/globo](globe-mars-desktop.png), [LRO](gallery-lro-desktop.png), [Block Island](gallery-block-island-desktop.png), [Apollo 11](gallery-apollo-11-desktop.png), [modo estático](bench-static-mobile.png).

## Archivos de esta tarea

Editados: `index.html`, `mission.js`, `analog-audit-ui.mjs`, `styles.css`, `package.json`, `README.md`, `docs/modulo-2.md`, `docs/contracts.md`, `docs/qa.md`.

Nuevos: `nasa-visual-math.mjs`, `nasa-stage.mjs`, `nasa-bench.mjs`, `nasa-explorer.mjs`, `tests/nasa-visual.test.mjs`, `scripts/check-nasa-browser.py`, `scripts/check-nasa-lifecycle.py` y los artefactos pequeños de esta carpeta de evidencia.

No se editaron los ámbitos del worker assets (`assets/models/nasa/`, `assets/textures/nasa/`, manifiesto, CREDITS, scripts de preparación y `docs/nasa-assets.md`). No se modificó `assets/models/perseverance.glb`, `sim-physics.mjs`, `mission-math.mjs`, `similarity.mjs`, el motor de auditoría ni el backend. Los demás cambios locales de catálogo/copiloto/M2/documentación previos se conservaron. No se atribuyen a esta tarea archivos ajenos que aparezcan en `git status`.

## Límites y trabajo pendiente

No faltan assets ni hay bloqueos de integración. El nuevo Perseverance de 9,21 MB se usa en banco/galería; la simulación conserva su modelo original y compatibilidad de nombres de ruedas, dimensiones y yaw. No se certificó un reemplazo cinemático. Las mallas se normalizan para visualización; no son medidas ni fuentes científicas. La masa reducida cambia inercia y el soporte no modifica gravedad del suelo/dinámica granular. No se acredita equivalencia física global, ensayos físicos, accesibilidad completa ni rendimiento en dispositivos reales. La ocultación nativa de documento requiere verificación en un navegador/runtime que la exponga; el código de suspensión está implementado y la suspensión fuera de vista sí se comprobó.

El servidor permanece activo para revisión del usuario. No hay cambio de API/contrato de servidor; las 53 pruebas backend previas se preservan y no se declara una nueva ejecución en esta tarea.
