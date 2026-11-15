# Preparación obligatoria y rendimiento de misión

Preview local activo: **http://localhost:8031/**. Trabajo local del 15 de noviembre de 2026, sin add, commit, push ni despliegue. Se conservaron servidores existentes, catálogo de 14 sitios, DEM y física SI, NASA, M2 y rover de ensayo terrestre → espejo planetario.

## Comportamiento entregado

Al terminar de cargar un destino se abre un diálogo sobre el visor, con **Zona del destino** y **Carga y resumen**. Hay un solo mapa y una sola carga, del destino. La zona se elige con tap, clic o teclado; las cartas y los marcadores comparten selección y conservan el foco. El resumen muestra contacto, coordenadas locales, pendiente, desnivel, cuerpo, porcentaje, kg de propelente y masa inicial. La comparación terrestre continúa siendo opcional y está disponible durante el vuelo.

**Confirmar preparación** habilita **Iniciar descenso**, dejando la nave detenida. Cerrar o Escape no confirman. El gate de `mission.js` valida escenario, generación de carga, perfil/DEM, zona y combustible actuales, además de la identidad de sesión M2. Se aplica a CTA, play, mando del visor, conducción y atajos/transmisión; no depende de atributos disabled. Editar zona/carga invalida la confirmación; reset y cambio/recarga de escenario crean una preparación nueva. Cámara, tasa y comparación no la invalidan. Sin candidato válido no se fuerza un vuelo. Cero combustible se admite como ensayo deliberado de fallo, con explicación antes de confirmar.

El evento `preparation-confirmed` queda en la bitácora de la misma sesión que recibe el vuelo, sin reiniciar la sesión al lanzar. Su detalle conserva zona, carga, kg, masa e identidad; las ediciones generan invalidación. Reiniciar no arrastra eventos confirmados de otra sesión. El JSON de misión añade la confirmación vigente en `preparation`; dossier y XLSX mantienen el evento y los datos canónicos del vuelo.

El diálogo conserva encabezado, etapas y acciones visibles, con scroll interno en móvil 390×844 y horizontal 844×390. Tab/Shift+Tab quedan dentro; Escape cierra y devuelve el foco. Se corrigió una salida real de Tab al body observada en Chromium. La guía de localStorage tiene versión `target-preparation-v3`. Las transiciones usan transform/opacity y respetan reduced-motion. Las reglas de anillo scoped aceptan :focus. Se comprueba retención de activeElement, navegación Tab/flechas/Enter y CSSOM real. Incluso con la pestaña seleccionada y visible, el host de automatización informa document.hasFocus=false: no se afirma haber observado la activación de pseudoclases de foco de una ventana nativa. El anillo amarillo de selección del mapa sí aparece en las capturas.

## Regresión y cambios de render

La causa era acumulativa: `view()` alias de `inspect()` copiaba perfiles, planes e historial completo en cada consulta. La misión lo consultaba reiteradamente por frame en bloqueos, escena, cámaras y HUD. `targetPose()` además clonaba el rover y recorría toda su ruta repetidamente. El [informe del controlador](../rendimiento-controlador/informe.md) conserva fuentes anteriores, microbenchmarks y medición real anterior/posterior con sus condiciones.

La integración de UI hace lo siguiente:

- Una lectura de `renderState()` por frame, compartida por escena, cámara y HUD; ninguna llamada a `view()`/`inspect()` en `mission.js` o `landing-view.mjs`.
- Una proyección espejo por frame, compartida por consumidores. La ruta usa `pathRevision`: cambia con reset/reemplazo o push/shift del avance real del rover. No se vuelven a proyectar puntos sin cambios.
- Los anillos y previsión usan `planRevision`, sin serializar zonas con JSON por frame. El DOM del mapa se construye al configurar, conserva sus nodos al elegir y solo actualiza selección/bloqueo cuando cambia el plan o su estado.
- El buffer de muestras de vuelo se actualiza con `historyRevision`, conservando las 1200 muestras máximas. El buffer de ruta rover se modifica cuando cambia su ruta, sin recorrerlo en cada frame estático.
- Selectores cacheados; textos/atributos/propiedades del HUD deduplicados; sliders y masa de carga se actualizan cuando cambian perfil, carga o bloqueo. Una sola actualización de estado por tick del HUD. Las dimensiones de canvas 2D llegan de ResizeObserver, sin consultar boundingRects tras escribir el HUD.
- Solo se actualizan capas de descenso visibles en misión. En catálogo/terreno se ocultan esas capas y no se ejecuta su escena/cámara; página oculta pausa vuelo y evita render/HUD innecesarios.

No se modificaron ecuaciones, perfiles, resolución DEM, subpasos, escala temporal, límites de captura ni archivos del exportador. No se redujeron animaciones o datos científicos para ocultar el coste.

## Medición conjunta y límites

El benchmark canónico de PERF mide diez consultas por lote: `view()` anterior en contacto (158 muestras) costó mediana **62,987 ms**, p95 **92,924 ms**; la API `renderState()` usada ahora queda por debajo de **0,001 ms** en esa microprueba. En el stress explícito de 1200 capturas, la lectura de render sigue sin recorrer ni clonar el historial. Las cifras tan pequeñas están cerca de la precisión práctica del microbenchmark y no significan porcentajes de FPS. Las copias de exportación `view/inspect/snapshot` conservan su coste y aislamiento; dejaron de usarse para pintar cada frame.

Se midieron antes y después dos vuelos reales Marius Hills, escritorio 1440×1000 y móvil emulado 390×844, cámara exterior, carga 100 %, tasa 1×, comparación desactivada, DPR≈1, Chromium150 y ANGLE AMD Radeon780M. La [evidencia del controlador](../rendimiento-controlador/informe.md) incluye n, mediana/p95 de deltas rAF, deltas >50 ms y eventos longtask crudos por fase. Las cifras observadas son:

| Ventana | Longtasks antes | Longtasks después | Deltas rAF observados después |
| --- | ---: | ---: | --- |
| Escritorio | 15 | 3 (solo exploración, 50/127/193 ms) | Mediana ~83,3 ms en todas las fases |
| Móvil emulado | 8 | 4 (51 ms descenso; 51 ms contacto; 69/58 ms exploración) | Intermitentes ~1000 ms; exploración mediana33,3 ms |

Son conteos crudos de ventanas con distinta planificación, no tasas normalizadas ni porcentajes de mejora. El host limita rAF de manera intermitente a ~1 segundo aun con la página visible; el baseline móvil empezó en33 ms y el posterior en1008 ms. Un delta rAF largo incluye espera del planificador/GPU y no equivale a una tarea JS larga. Las cuatro tareas posteriores móviles y tres de escritorio no tienen atribución causal demostrada; no se estableció un patrón periódico. **Esta máquina no permite afirmar una mejora causal de FPS o ausencia de todas las pausas.** Sí se reproduce y elimina el trabajo de clonación por consulta en el camino de render.

Las capturas posteriores incluyen toda la migración principal, el gate y CSS de preparación. Después se afinó el replay decorativo por fase con Web Animations y algunos selectores/escrituras estáticas del HUD; esos ajustes menores se validan funcional y visualmente y no se atribuyen a las métricas anteriores. No se ejecutaron suites Node durante los vuelos posteriores. El informe PERF documenta el solapamiento inicial de Node con parte del baseline de escritorio y todas las limitaciones del host.

## Evidencia ejecutada

`preparation-only-checks.json` contiene 26 comprobaciones reales: gate de cinco entradas de producto, Enter, transmisión, Escape, foco Tab, mapa por teclado, dos pasos, confirmación sin vuelo, invalidación de carga/zona/reset/escenario, ausencia de eventos obsoletos, cero combustible, móvil, horizontal y reduced-motion. No llama directamente al controlador ni sustituye física/render.

`preparacion-personalizada-mission.json`, `preparacion-personalizada-dossier.json` y `preparacion-personalizada.xlsx` son bytes descargados desde sus controles UI, con el vuelo en pausa. `qa-preparation-exports.py` comprueba identidad entre los tres, la zona seleccionada, 80 % = 144 kg, masa inicial 994 kg, combustible de la primera muestra, Tierra sin vuelo y el detalle JSON exacto del evento en la hoja Limites_eventos. Se conservaron las 15 hojas, incluidas Descenso, Trayectoria y Zona_ensayo; resultado en `exportacion-validada.json`. No se reconstruyeron libros para esta evidencia.

Capturas inspeccionadas con view_image: `desktop-zona.png`, `desktop-carga-resumen.png`, `mobile-zona.png`, `mobile-carga-resumen.png`, `mobile-resumen-completo.png`, `landscape-resumen-completo.png`, `desktop-vuelo-pausado.png`, `desktop-rovers-espejo.png`, `movil-descenso.png` y `movil-rover-espejo.png`. La [revisión visual](../preparacion-diseno/) conserva probes CSSOM, geometría y reduced-motion del navegador.

Escritorio completó los cuatro escenarios con **42 checks** (`desktop-only-checks.json`): target-first, carga personalizada, pausa/cámaras/tasas con estado SI conservado, contacto retenido y autorización manual, rovers con offsets independientes, conducción terrestre reflejada, actitud de cada suelo, transmisión/cámara mástil, ausencia de desborde, combustible cero con fallo retenido y catálogo legacy directo. Móvil 390×844 completó **dos destinos, Luna y Marte, con 27 checks** (`mobile-only-checks.json`), incluyendo los mismos bloqueos, control espejo, cámaras y fallo de combustible. El bloque visual final terminó con **6 checks** (`visual-only-checks.json`) y probes CSSOM sin propiedades no soportadas. La medición posterior se resume arriba; los clics de QA no son una medición de fluidez.

El **check final después de los refinamientos UI y de la postmedición pasó con 214 pruebas, cero fallos**; `check-final.txt` conserva sintaxis y salida completa. Los 196 tests originales siguen dentro de la suite; se añadieron pruebas del controlador/performance, la preparación y otros cambios ajenos ya existentes en el workspace.

## Reproducir

Desde Atlas y con una página Orca dedicada al preview:

```sh
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --preparation-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --desktop-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --mobile-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --fallback-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --motion-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --extras-only
python3 scripts/qa-target-mission.py PAGE_ID http://localhost:8031/ --visual-only
python3 scripts/qa-preparation-exports.py
# Alternativa secuencial para visual/móvil/fallback/motion/extras:
python3 scripts/qa-preparation-final.py PAGE_ID http://localhost:8031/
npm run check
```

Los entrypoints QA anteriores redirigen al recorrido vigente y ahora atraviesan zona, resumen y confirmación antes de iniciar. El harness selecciona la pestaña real antes de probar. El host marcó documentos srcdoc como ocultos incluso con la pestaña padre visible, interrumpiendo el vuelo de una fixture; se descartó esa ejecución. Los fallbacks se prueban cargando el mismo HTML local en un documento principal temporal con base de recursos al preview e inyección inicial de 404 o contexto WebGL no disponible. No se sobrescribe document.hidden ni se cambia la política de pausa para hacer pasar la prueba; al terminar se vuelve al preview HTTP limpio. Los archivos son evidencia de simulación local, no observaciones de una misión física.
