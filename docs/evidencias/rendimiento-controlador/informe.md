# Rendimiento del controlador de descenso

Medición local, 15 de noviembre de 2026. Sin add, commit, push ni despliegue. Física SI, cadencia de captura de 0,25 s, validadores y escritor Excel conservados.

## Causa reproducida y cambio

La versión anterior está conservada literalmente en `controller-before.txt`. En `inspect()` (también `view()`) cada consulta clonaba perfiles, ambos planes y **todo el historial**, y recalculaba resúmenes con metadatos/georreferencia. `origins()` volvía a construir orígenes y copiar georreferencia. Las llamadas repetidas desde la actualización de misión, cámaras y escena multiplicaban ese coste por frame. La regresión aumentaba con las muestras acumuladas, incluso detenido en contacto.

`targetPose()` recorría y transformaba la ruta completa y después hacía `structuredClone(rover)`, copiando otra vez la ruta que acababa de reemplazar. La escena además filtraba el historial y serializaba configuraciones estáticas reiteradamente. El worker de UI es dueño de la migración de esos consumidores; este cambio del controlador no modifica `mission.js`, `landing-view.mjs`, HTML ni CSS.

Ahora `renderState()` devuelve un objeto inmutable cacheado. Planes/perfiles se reutilizan hasta configure/choose; resúmenes se cachean por identidad del estado físico inmutable y los orígenes por resúmenes/origen terrestre/modo. `revision` cambia con estado/lifecycle, `planRevision` con configure/choose y `historyRevision` con configure/start/muestra. El historial es una vista **viva**, readonly, acotada a 1200 filas congeladas; construir/leer el estado de render no lo clona ni lo recorre. Una referencia de render antigua conserva sus escalares y observa nuevas filas por esa vista viva: no es un snapshot de archivo. `view()`, `inspect()` y `snapshot()` siguen devolviendo copias profundas independientes, editables por el consumidor.

`renderTargetPose(rover, {includePath:false})` proyecta solamente escalares y reutiliza resultados iguales. `{includePath:true}` añade una ruta validada readonly; sin versión se comparan todas las coordenadas para detectar edición interna arbitraria, push y shift con longitud constante. `pathRevision` permite reutilizar sin recorrer la ruta: el llamador debe cambiarla ante **cualquier** mutación. `targetPose()` conserva extras y retornos profundamente aislados; ya no clona la ruta de entrada para descartarla. No se almacena ni modifica la ruta del rover dentro del registro canónico. Getters baratos: `mirrorAvailable`, `options` (readonly).

## Benchmark de controlador

Comando reproducible: `node scripts/benchmark-landing-state.mjs --stress-history`. Archivos: `benchmark-before.json`, `benchmark-after.json`. Node v22.16.0, Linux x64. Cada celda mide **10 lecturas**, repetidas en 50 batches tras calentamiento; mediana/p95 en milisegundos. No hay umbral dependiente de hardware. Los valores diminutos de la API de render están cerca de la precisión práctica del microbenchmark y no se convierten en porcentajes de FPS.

| Estado / nº muestras | view antes mediana/p95 | view después mediana/p95 | renderState después mediana/p95 |
| --- | ---: | ---: | ---: | ---: |
| ready / 0 | 1.141 / 2.415 | 1.565 / 2.973 | <0,001 / 0.001 |
| flight-25-SI-seconds / 107 | 38.767 / 53.800 | 55.482 / 71.615 | <0,001 / 0.002 |
| contact / 158 | 62.987 / 92.924 | 84.137 / 100.443 | <0,001 / <0,001 |
| exploration / 164 | 73.394 / 97.859 | 89.650 / 108.734 | <0,001 / <0,001 |
| 1200-bounded-records-explicit-recorder-stress-not-a-longer-flight / 1200 | 544.582 / 604.721 | 613.889 / 762.742 | <0,001 / <0,001 |

Proyección de 1200 puntos, mediana/p95 por diez llamadas: `targetPose` antes 3.818 / 5.739 ms; después 0.403 / 1.423 ms; render escalar 0.012 / 0.080 ms; render con ruta validada sin versión 0.074 / 1.201 ms; render con ruta versionada 0.011 / 0.020 ms.

Benchmark final capturado 2026-11-15T06:47:57.285Z; SHA-256 del controlador medido: `ce8153b6cb7abfb04abb94e611046d4de1c77a80780ffa5e8db4ec7de03315cb`. SHA-256 del código anterior conservado: `7404f1fe5940d871d8fe7d5c68dc687a6dec3953df848592d37a06dbc34e5d13`. El benchmark final se ejecutó después de finalizar los tests Node propios y de UI, sin solaparlos. La copia pública conserva coste lineal en el historial y puede ser más lenta en esta ejecución; la mejora del hot path consiste en migrar sus consumidores a la API de lectura cacheada, sin usar el coste de exportación como presupuesto por frame.

El vuelo del benchmark usa el motor real, tasa 1× y Marius Hills. Las 1200 filas adicionales son un stress explícito del método público `record(true)` con física detenida, **no** una afirmación de que el vuelo normal produce 1200 muestras. Cada fila sigue capturándose de manera independiente, también respecto del estado corriente; congelarla impide que el render modifique el pasado. Son 1200 capturas con valores físicos repetidos, no 1200 estados físicos distintos. La prueba estructural sí verifica 1200 filas, límite, exportación completa, aislamiento y cero clonaciones por lectura de render. La ruta de 1200 puntos es una fixture sintética dentro de cobertura, únicamente para medir operaciones de proyección.

## Navegador real: protocolo y limitaciones

Se usó el navegador integrado de Orca en `http://localhost:8031/`, página `0cab6187-6ca9-462d-81b0-5b32807871ec`, antes de modificar las fuentes. Los workers de UI y CSS esperaron `baseline-listo` hasta finalizar ambos vuelos baseline. Captura con `measure-browser.py start`, lectura posterior con `measure-browser.py collect <archivo>`; el inicio no bloquea el CLI. Se observó rAF y `PerformanceObserver` de `longtask`, sin sustituir física, controlador ni renderer. Vuelo Marius Hills a 1×, cámara exterior, análogo opcional desactivado, carga 100 %. Reposo 8 s, descenso temprano (<15 s desde entrar a descent), tardío, contacto retenido 6 s, despliegue autorizado por control real y rovers 8 s.

Configuración: Chromium 150.0.7871.250 en Windows anfitrión, ANGLE AMD Radeon 780M / Direct3D11; DPR solicitado 1, reportado 1.0000000447. Escritorio 1440×1000, móvil 390×844 mediante `orca-ide viewport --mobile --scale 1`; móvil es emulación de viewport/entrada, no hardware móvil. Cada JSON incluye UA, renderer, DPR, cámara, dimensiones, soporte de longtask, visibilidad y advertencia VSync. No se infiere FPS independiente de VSync, emulación o carga del host.

El planificador del host mostró intervalos intermitentes de aproximadamente 1000–1033 ms aun con `document.visibilityState === 'visible'`, también en reposo: el baseline de escritorio tuvo mediana idle 1008 ms y el móvil 33 ms. Esto impide atribuir diferencias de FPS al código. Durante los primeros segundos de la captura desktop coincidió el comienzo del benchmark Node en WSL; se suspendió antes de terminar desktop y durante todo el baseline móvil. No se comparan porcentajes de FPS entre estas ventanas. Los tiempos de API y conteos estructurales sustentan la eliminación causal de las copias por frame; las muestras del navegador documentan la experiencia observada y sus límites.

### Escritorio

| Fase | n antes | mediana / p95 antes, ms | >50 ms antes | n después | mediana / p95 después, ms | >50 ms después |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reposo / preparado | 7 | 1008.3 / 1008.4 | 7 | 97 | 83.3 / 83.5 | 94 |
| Reconocimiento | 1 | 1000.1 / 1000.1 | 1 | 19 | 83.3 / 83.6 | 19 |
| Descenso temprano | 80 | 25.0 / 1008.3 | 19 | 182 | 83.3 / 83.5 | 180 |
| Descenso tardío | 58 | 66.8 / 1033.3 | 30 | 274 | 83.3 / 83.5 | 270 |
| Contacto retenido | 11 | 1000.0 / 1008.6 | 9 | 77 | 83.3 / 83.5 | 72 |
| Despliegue | 2 | 1008.4 / 1008.4 | 2 | 14 | 83.3 / 83.5 | 14 |
| Rovers | 9 | 1008.2 / 1008.5 | 9 | 75 | 83.3 / 83.5 | 73 |

Tareas largas observadas: 15 antes, 3 después. Son conteos crudos de esta ventana, no una tasa normalizada ni un porcentaje de mejora.

### Viewport móvil emulado

| Fase | n antes | mediana / p95 antes, ms | >50 ms antes | n después | mediana / p95 después, ms | >50 ms después |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reposo / preparado | 216 | 33.2 / 58.4 | 22 | 10 | 1008.2 / 1008.4 | 7 |
| Reconocimiento | 20 | 33.3 / 1024.9 | 3 | 1 | 1000.1 / 1000.1 | 1 |
| Descenso temprano | 197 | 33.3 / 58.4 | 19 | 15 | 1008.2 / 1008.4 | 15 |
| Descenso tardío | 57 | 41.6 / 1033.3 | 22 | 62 | 42.3 / 1008.3 | 30 |
| Contacto retenido | 35 | 41.7 / 1033.4 | 13 | 11 | 1000.0 / 1008.3 | 8 |
| Despliegue | 5 | 66.7 / 1058.2 | 3 | 1 | 1000.1 / 1000.1 | 1 |
| Rovers | 9 | 1025.1 / 1041.5 | 9 | 120 | 33.3 / 100.2 | 52 |

Tareas largas observadas: 8 antes, 4 después. Son conteos crudos de esta ventana, no una tasa normalizada ni un porcentaje de mejora.

En escritorio, las tres tareas posteriores ocurrieron durante exploración (127, 50 y 193 ms), con sus inicios agrupados en 1,09 s. En móvil hubo una de 51 ms durante descenso, una de 51 ms en contacto y dos en exploración (69 y 58 ms), cuyos inicios se separaron 4,57 s. **Atribución desconocida:** no hay perfil de CPU ni pilas para distinguir carga/transición de trabajo recurrente. Esta ventana no establece un patrón periódico; tampoco permite afirmar cero tirones. No hay evidencia de atribución al pipeline M2 para modificar captura, validación o Excel.

Después, la cadencia de escritorio fue aproximadamente 83,3 ms incluso en reposo; el móvil volvió a alternar intervalos próximos a 1000 ms con otros de 33–42 ms. La eliminación de trabajo CPU por lectura queda probada por el benchmark y los contadores estructurales, pero no se presenta una mejora de FPS atribuible al controlador. `elapsed` en los JSON llega hasta la recolección y puede incluir espera posterior a `done`; las estadísticas de frames y tareas se detienen al completar la ventana de rovers.

Ambos vuelos posteriores confirmaron primero la preparación por next → confirm con los controles reales, permaneciendo en ready; el inicio ocurrió mediante la acción del visor después de 8 s de reposo. Al finalizar, se dejó ready con diálogo abierto en la primera etapa, 1×, carga 100 %, cámara exterior, sin comparación y viewport 1440×1000 (evidencia `browser-final-state.json`). El navegador se liberó al worker UI para sus comprobaciones finales. Después de estas capturas, UI ajustó la reproducción decorativa de una transición mediante Web Animations (400 ms, transform/opacity y reduced-motion, sin lectura offsetWidth), cacheó dos selectores estáticos, deduplicó escrituras de texto/hidden de telemetría/HUD y actualizó el texto del perfil solo al cambiar su identidad. Estos refinamientos posteriores no están medidos por los vuelos; su QA valida comportamiento y animación. Las capturas cubren la migración principal render/gate/CSS y no se atribuye FPS al runtime UI con esos refinamientos finales.

Los JSON `browser-before-desktop.json`, `browser-before-mobile.json` y sus equivalentes posteriores contienen n, mediana, p95, conteo de deltas >50 ms por fase y entradas crudas de tareas largas. Un delta >50 ms no equivale a una tarea JavaScript >50 ms; incluye espera del planificador/GPU. El etiquetado del observador de tareas usa la fase observada al entregar el callback.

## Verificación

Pruebas focales: `node --test tests/landing-controller.test.mjs tests/landing-interaction.test.mjs tests/landing-target-first.test.mjs tests/landing-performance.test.mjs`. Evidencia final en `tests-focused.txt`: 26 pruebas, 0 fallos. Las seis nuevas cubren identidad/caché/revisiones, lecturas sin clonación, readonly, exportación de 1200 filas y sesiones anteriores, mutaciones internas de ruta/push/shift/reemplazo, pose/heading/cobertura, versión de ruta sin lecturas de puntos, lectura sincrónica coherente desde callbacks event/deploy (incluido el segundo lado legacy), cuatro escenarios, paired-legacy y ausencia honesta de Tierra.

Una revisión adicional corrigió invalidación transitoria durante callbacks sincrónicos: `emit` invalida antes del observador, cada avance físico invalida tras asignar su lado y el despliegue invalida antes del callback. Se reinició la captura posterior desde reload con esta corrección; el primer intento posterior quedó descartado sin incorporarlo a la evidencia.

La preparación obligatoria y su confirmación en la única frontera de inicio son trabajo de UI; el contrato público `start()` del motor se conserva. La validación global corresponde al worker de UI/coordinador. No se editaron pipeline de auditoría ni exportador.
