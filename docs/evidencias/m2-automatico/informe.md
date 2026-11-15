# M2 automático de Atlas: entrega local

Implementación terminada en la copia de trabajo; sin commit, push ni despliegue. Vista previa con FastAPI y frontend del mismo origen: http://localhost:8027/ (`npm start -- --port 8027` desde Atlas; terminal Orca `term_9bb7adf8-b8d1-48c1-9a24-6067e3edff06`). Se conserva la vista estática anterior 8016 y hay una segunda estática de QA en 8028.

## Qué cambia

Elegir un escenario alimenta cuerpo, coordenadas, gravedad, DEM y masa compartida del simulador sin completar campos. `rover-config.mjs` fija el prototipo de 350 kg con fuente `prototype-config`; no atribuye esa masa al modelo NASA. El panel muestra variables/procedencia, ausencias, reloj UTC, tiempo SIM ×20 y estado/fecha del clima. Aire, superficie Diviner/MCD y equipo están separados; la presión absoluta superficial llega en Pa desde la API. Rueda, taladro, dosimetría, cámaras y modelos térmicos explican aplicabilidad y ausencias, sin afirmar instrumentos físicos conectados.

El seguimiento actualiza valores a 1 Hz y registra rover cada 10 s (2160 muestras máximas), con 256 observaciones de clima y 500 eventos por sesión; se retienen hasta seis sesiones en memoria. Cambio o reinicio abre una sesión aislada; reload borra memoria. Hay cancelación y token para respuestas viejas, refresco meteorológico por sitio a 600 s, recuperación de backend ausente a 30 s y deduplicación por sitio/proveedor/hora de observación. El laboratorio manual es opcional y no contamina reportes ni contexto de misión.

El botón Excel genera OOXML/ZIP real local, sin librería npm obsoleta, fórmulas activas, upload ni servicio externo. Incluye 12 hojas con sesión actual, instantánea con corte UTC, historia, matriz/procedimientos, ambos modos estáticos, térmica separada, herramientas, siete modelos NASA y dos texturas, fuentes y eventos. Strings externos siempre son celdas de texto; números mantienen su tipo y faltantes llevan razones. Todas las hojas incluyen filtros y primera fila congelada. JSON, Markdown, exportación general, banco 3D, galería y globos siguen disponibles.

## Archivos de esta integración

- `rover-config.mjs`, `mission-audit.mjs`, `xlsx-report.mjs`: configuración única, adaptación/sesiones y escritor Excel.
- `analog-audit.mjs`, `analog-audit-ui.mjs`, `mission.js`, `sim-physics.mjs`, `copilot-rules.mjs`: procedencia, seguimiento, aislamiento, simulación y contexto.
- `index.html`, `styles.css`, `nasa-bench.mjs`: flujo automático, laboratorio opcional y copia del banco; conserva assets y branding.
- `scripts/start-local.mjs`, `package.json`: arranque API por defecto y alternativa estática.
- `tests/mission-audit.test.mjs`, `scripts/check-m2-browser.py`, `scripts/check-m2-refresh.py`, `scripts/check-m2-view-session.py`, `scripts/validate-m2-xlsx.py`: validación reproducible.
- `README.md`, `docs/modulo-2.md`, `docs/contracts.md`, `docs/candidate-analog-payload.schema.json`, `docs/qa.md`, esta carpeta: contrato, uso y evidencia.

Los cambios previos de documentación/challenge, revisión 2025, assets, galería y banco se conservan. Los archivos backend pertenecen al worker coordinado y no fueron editados por esta integración.

## Evidencia reproducible

Resultado final: 71/71 pruebas JS, 32/32 verificaciones de navegador (20 + 6 + 6), lectura XLSX independiente y diff sin errores de whitespace; 135 pruebas backend verificadas por su worker.

- `js-check.txt`: 71/71 pruebas JS y sintaxis aprobadas.
- `browser-results.json`: 20/20 verificaciones de navegador desktop/móvil, API real, rover en movimiento/historia, descarga, aislamiento de laboratorio y misiones, ambos modos, factores, siete GLB y dos globos; fallos/carreras con mocks rotulados.
- `refresh-static-results.json`: 6/6 verificaciones adicionales: estático real honesto; backend reaparece tras fallo inicial, ventana previa a TTL y consulta posterior, observación repetida deduplicada, recuperación visible y parada pagehide.
- `view-session-results.json`: 6/6 pruebas de aislamiento al salir/volver al modo sitio, cambio inmediato de escenario, reselección sin reset, reinicio y catálogo servido.
- `browser-console.json`: sin errores en la verificación live.
- `Atlas-M2-mision-real.xlsx`: descarga real desde el panel durante recorrido lunar; `mission-snapshot-real.json` conserva contexto/historia correspondiente y `real-api.json` conserva una respuesta API real.
- `xlsx-validation.json`: lectura independiente con openpyxl en `/tmp/selene-m2-xlsx-validation`, ZIP CRC, 12 hojas, números, historia y valores, nulos, nueve recursos NASA, ausencia de fórmulas y fixture de Unicode/XML/controlchars/cadenas tipo fórmula (`strings-seguras.xlsx`, rotulado prueba).
- Capturas inspeccionadas con view_image: `automatico-desktop.png`, `marte-desktop.png`, `automatico-mobile.png`, `static-archivo-desktop.png`.
- `backend-worker-report.md`: evidencia del worker backend (135 pruebas, sin repetir su suite); `backend-atacama-real.json`: su consulta real independiente, presión 90230 Pa y aire 21.3 °C.

Para reproducir los checks GUI, abrir la URL en Orca y pasar su ID: `python3 scripts/check-m2-browser.py --page ID`, y `python3 scripts/check-m2-refresh.py --page ID` con servidor estático8028 disponible. El segundo arnés usa reloj/red simulados explícitos para recorrer TTL sin esperar diez minutos y restaura una página real al finalizar. También: `python3 scripts/check-m2-view-session.py --page ID` para continuidad y separación entre modo sitio y escenario. Validación XLSX: `/tmp/selene-m2-xlsx-validation/bin/python scripts/validate-m2-xlsx.py` (o entorno propio con openpyxl).

## Límites declarados

El registro es de memoria, no almacenamiento durable. El rover es simulación didáctica, el clima current es modelo meteorológico y los datos lunares/marcianos son archivo/modelo/referencia; ningún instrumento físico está conectado. Los cálculos de carga solo describen estática y no certifican dinámica, terramecánica o aptitud de misión. Área/h/emisividad/temperatura del equipo y dosis permanecen desconocidos cuando faltan fuentes. El runtime Orca no expone una prueba fiable de `document.hidden=true` y bloquea su redefinición; se revisó la implementación de suspensión oculta y se probaron recuperación visible/pagehide, sin afirmar verificación nativa del estado oculto. No se probó proveedor LLM externo porque no es necesario.
