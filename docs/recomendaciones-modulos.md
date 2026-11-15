# Recomendaciones locales para S.E.L.E.N.E. Ops

Revisión del código y los datos locales: 14 de noviembre de 2026. Este documento propone el siguiente sprint de los módulos **1, 3, 4 y 5**; no implementa esas propuestas ni modifica el módulo 2, que se integra en otro frente. La arquitectura general describe una visión; las capacidades comprobables hoy son las de Atlas. No se verificaron servicios, cuotas, modelos comerciales ni disponibilidad de nuevos productos por Internet.

## Base aprovechable y arquitectura mínima

Atlas ya tiene JavaScript puro, Three.js local, funciones físicas y geométricas sin DOM, catálogo documental de 14 sitios, cuatro parejas Tierra–objetivo y FastAPI opcional. Sus archivos permiten una demo local con meteorología archivada y copiloto por reglas. La exportación actual es un registro JSON de misión; no constituye todavía el expediente científico Markdown/PDF de la visión.

Mantener esa estructura: **scripts Python de preparación → JSON locales con procedencia → funciones JS deterministas → paneles y exportación en `mission.js`**. Reutilizar FastAPI para conectores opcionales y secretos por servidor. Separar responsabilidades mediante funciones y contratos en el mismo proyecto; posponer React, contenedores por módulo, colas y microservicios hasta que exista una necesidad medida. Ninguna propuesta del sprint debe exigir claves, descargas en la demo ni despliegue; una caché de datos preparada y un servidor estático local bastan para mostrar el flujo.

## Contratos comunes y procedencia

La referencia vigente es [contracts.md](contracts.md), junto con los JSON de `assets/data/scenarios/`. `CandidateAnalogPayload` aparece como intención en la arquitectura general; aquí se propone un adaptador, sujeto al contrato que entregue el frente del módulo 2, sin definirle otro formato incompatible.

| Elemento | Reutilizar hoy | Extensión propuesta para acordar antes de programar |
| --- | --- | --- |
| Identidad y geometría | `scenario.id`, `earthId`, `targetId`, `body`, `center` en orden latitud/longitud | ID estable de celda, polígono y CRS explícito; marco y convención de coordenadas por cuerpo. No confundir `[lat, lon]` del contrato con `[lon, lat]` de GeoJSON. |
| Escala y métricas | `gridSize`, `spacingMeters`, `extentMeters`, `nativeResolutionMeters`, `metrics`, `comparable` | Cobertura válida, resolución efectiva y método/versiones de reproyección y cálculo. Mantener `terrain_metrics.py` como receta común. |
| Evidencia | `source`, `provenance`, `fetchedAt`, `notes`, licencias, `thermal.kind` | Por variable: unidad, magnitud física, soporte espacial, instante/período, nivel o profundidad, incertidumbre o su ausencia; ID y versión del producto. Separar fecha de adquisición, descarga, emisión de pronóstico y validez. |
| Resultados de módulos | Índice geométrico y contexto actual del copiloto | Sobre común con versión de esquema, IDs de entrada, versión del método, parámetros, referencias a evidencia, resultados y límites; acordar cómo anexarlo al payload del módulo 2. |
| Ausencias y estados | `null`, advertencias, `live`, `cached`, `ageSeconds`, `provider` | Distinguir «sin dato», «no aplicable», «estimación» y «validado con evidencia»; estos son estados propuestos. No convertir `null` en cero ni asignar confianza numérica sin calibración. |

El índice actual es **geométrico**, con pesos editoriales; no mide semejanza planetaria ni probabilidad de éxito. Un `comparable:true` solo pasa el criterio técnico de resolución del prototipo: no valida similitud física. En radar, igualdad de unidad es necesaria pero insuficiente: también deben coincidir producto, polarización, geometría y tratamiento radiométrico.

## Datos: lo existente y el siguiente uso responsable

Las referencias externas de esta tabla ya aparecen en código o documentación del repositorio; se citan como procedencia, sin afirmar disponibilidad actual. Los detalles e IDs planetarios están en [targets-sources.md](targets-sources.md).

| Fuente/producto | Estado local y recomendación |
| --- | --- |
| [Planetary Computer STAC](https://planetarycomputer.microsoft.com/api/stac/v1) | `fetch-scenarios-earth.py` usa `cop-dem-glo-30`, `sentinel-2-l2a` y `sentinel-1-rtc`. Reutilizar búsquedas por ventana y manifiestos con IDs/fechas; STAC es catálogo de activos, no un motor de similitud. Guardar activos necesarios para la demo. |
| Copernicus DEM / Sentinel | Tierra tiene GLO-30, imágenes Sentinel-2 y un resumen regional Sentinel-1 RTC. GLO-30 es modelo de superficie; vegetación y construcciones pueden influir. No confundir el paso del raster radar remuestreado con resolución física, ni usar una escena para afirmar un evento temporal. |
| [Meteomatics](https://www.meteomatics.com/en/api/getting-started/) | Conector existente para valores actuales de modelo: aire a 2 m, viento a 10 m, ráfagas, humedad, nubes e irradiancia. No aporta hoy serie de 72 h, temperatura de suelo ni presión en este contrato. Extender solo tras confirmar parámetros, unidades, cobertura y acceso; conservar archivos locales. Open-Meteo ya es respaldo opcional, también de modelo. |
| NASA LRO / PDS Diviner | Marius Hills: GCP térmico acumulado, celda de 0.5° (~15 km), curva con una hora local sin dato. Shackleton: PRP regional (~0.5 km), media/máximo anuales, `minK:null`, `curve:null`. No inventar mínimos ni una curva polar; ninguno describe temperaturas actuales dentro de una cueva. |
| JAXA / SELENE y ALOS | Ya hay Kaguya TC para Marius Hills (~33 m) vía USGS. ALOS DEM y G-Portal son opciones de la visión, sin conector local acreditado: antes de agregarlos identificar producto, versión, cobertura, datum, licencia y acceso. No asumir que están en Planetary Computer ni que JAXA aporta ya un DEM terrestre al flujo. |
| CSA RADARSAT-1 / RCM | Propuesta de la arquitectura, sin productos ni pipeline local en Atlas. Verificar por producto archivo, acceso, condiciones y cobertura antes de comprometer integración. El MVP aprovecha Sentinel-1; no inventar una API CSA ni anunciar integración RADARSAT implementada. |
| LRO Mini-RF / objetivos marcianos | Existe CPR regional en Shackleton (~237 m/píxel); Marius Hills queda `null` por cobertura insuficiente. CPR y dB terrestres quedan fuera de comparación entre sí. Jezero/CTX tienen DEM; su térmica es **Mars Climate Database, modelo**, no medición MEDA ni THEMIS. |

La rejilla compartida cubre **2.4 × 2.4 km (5.76 km²), 65 × 65 nodos a 37.5 m**. Mantenerla para este sprint y registrar cualquier experimento de 2 × 2 km como otra escala. Remuestrear no añade información: la resolución efectiva de LOLA puede ser más gruesa que sus 5 m nominales por interpolación; promediar HiRISE elimina obstáculos pequeños. Las capas térmicas y radar pueden abarcar mucho más que una celda del DEM. El pozo de Marius Hills no está resuelto en la rejilla; un sombreado 3D tampoco demuestra sombra permanente.

## Módulo 1 — descubrimiento de candidatos

**Existe:** ranking documental por etiquetas en `app.js`, selección fija de cuatro escenarios, métricas comunes y comparación en `similarity.mjs`. **Brecha:** no hay búsqueda mundial sistemática, embeddings geoespaciales ni demostración de sitios inéditos.

**Siguiente incremento:** preparar fuera de la demo un pequeño lote reproducible de celdas de una región, con manifiesto local, límites, cobertura y métricas calculadas por `terrain_metrics.py`. Rankear determinísticamente contra un objetivo usando las dimensiones disponibles; explicar pesos, componentes excluidos y empates. Mostrar Top 5 o todos si hay menos elegibles, además del número total analizado y los descartes. No hacer competir resoluciones efectivas distintas sin armonización y advertencia; dejar aridez y amplitud térmica sin puntuar cuando falten series compatibles.

Separar antecedentes de ensayo del índice geométrico. Llamar «candidato por evaluar» a un sitio nuevo para el catálogo: demostrar novedad científica requiere revisión documental adicional. Empezar con vectores físicos interpretables; incorporar embeddings solo si una evaluación con referencias independientes mejora el ranking y conserva explicación y procedencia.

**Aceptación/demo:** con el mismo manifiesto se reproduce el mismo orden; cada candidato abre su ventana y sus fuentes; una celda incompleta o no comparable tiene motivo visible y no queda presentada como mejor por falta de datos. Poder cargar el candidato al auditor del módulo 2 mediante el contrato acordado.

## Módulo 3 — procesos y ventanas de ensayo

**Existe:** meteorología actual de modelo, caché, lectura archivada, térmica planetaria publicada/modelada y simulación física simplificada. **Brecha:** no hay detector validado de polvo, saltación, congelación ni ventanas operativas de 72 horas.

**Siguiente incremento:** cargar una serie horaria local con procedencia y emisión/validez explícitas; graficar solo magnitudes comparables. La temperatura de aire a 2 m **no es temperatura superficial** de Diviner; tampoco la humedad relativa del aire demuestra hielo en el suelo. Cualquier temperatura superficial estimada necesita balance energético, propiedades del material, condiciones de contorno y validación independiente. Aire y superficie pueden verse juntos con etiquetas distintas, sin restarlos como si midieran lo mismo.

Proponer ventanas mediante reglas deterministas parametrizadas para un instrumento concreto (viento máximo, intervalo térmico y duración mínima), rotuladas «ventana exploratoria según reglas». Publicar umbrales, datos faltantes y cobertura; si falta una variable necesaria, resultado «no evaluable». Comparar fase de calentamiento/enfriamiento solo con referencia térmica compatible, indicando duración física de días terrestre, lunar y marciano: las 24 divisiones de hora local de una curva lunar no equivalen a 24 horas terrestres. No completar la curva nula de Shackleton.

Viento fuerte puede activar una alerta ilustrativa; no demuestra polvo ni saltación sin propiedades del grano, humedad, esfuerzo umbral y observaciones. Congelación y tormentas marcianas requieren modelos/evidencia propios; Sentinel/RADARSAT serían evidencia temporal complementaria, no telemetría continua.

**Aceptación/demo:** una serie archivada produce ventanas explicables y reproducibles; otra con huecos queda no evaluable; ninguna se anuncia «validada» ni «en vivo». Registrar como pendiente la validación contra observaciones y métricas de acierto antes de usar ventanas como recomendación de campo.

## Módulo 4 — terreno, SAR e hipótesis de subsuelo

**Existe:** pendientes y relieve regional del DEM, retrodispersión Sentinel-1 resumida por ventana y Mini-RF CPR parcial. **Brecha:** no hay detector de cavidades, mapa de bloques, clasificación de peligros calibrada ni navegación subterránea validada.

**Siguiente incremento:** primero derivar una capa local de pendiente regional con umbrales configurables por vehículo, máscara de datos y advertencia de escala. Los 15° de la visión son un criterio propuesto, no un límite universal de seguridad. Después, como experimento separado, comparar adquisiciones SAR compatibles en órbita, incidencia, polarización, estación y preprocesado, con controles de calidad y causas alternativas de cambio. Humedad, vegetación, geometría y rugosidad influyen en la señal; no llamar «rugosidad medida» al proxy de retrodispersión.

**SAR orbital no demuestra cavidades profundas, tubos transitables ni espesor de techo.** Una anomalía, depresión o CPR elevado solo justifica una hipótesis localizada y documentada; tampoco demuestra hielo. Para validar subsuelo se necesita evidencia independiente adecuada (cartografía publicada, radar de penetración terrestre, levantamientos o inspección de campo según el caso). No extrapolar de radar de imagen a radar de sondeo. Sombras permanentes requieren geometría solar y relieve temporal; un DEM de decenas de metros no certifica rutas libres de rocas a escala rover.

**Aceptación/demo:** mostrar pendiente con su escala y máscara, evidencia SAR regional y una hipótesis claramente separadas. Una zona sin cobertura queda «sin dato», nunca «segura»; el expediente no contiene cavernas confirmadas ni recomendaciones de tránsito deducidas solo del SAR.

## Módulo 5 — integración, expediente y copiloto

**Existe:** vista Tierra–objetivo con cámaras sincronizadas, física de rover exploratoria, fuentes visibles, registro JSON y Flight Director local; FastAPI ofrece IA opcional mediante Gemini o Anthropic. **Brecha:** falta un expediente científico que consolide resultados versionados de los cinco módulos y sus ausencias.

**Siguiente incremento:** construir un objeto de informe determinista a partir del candidato y las salidas disponibles, y exportarlo como Markdown además del JSON existente. Incluir objetivo/celda, escala, ranking y pesos, auditoría del módulo 2, procesos/ventanas, riesgos/hipótesis, fuentes, fechas, parámetros, advertencias y módulos pendientes. Ausencia de salida no equivale a auditoría favorable. PDF puede esperar a que el contenido sea estable.

Los cálculos físicos, conversiones, ranking y decisiones por umbral deben seguir en funciones deterministas con unidades y supuestos explícitos. El copiloto explica esos resultados; no calcula factores físicos por generación de texto ni certifica seguridad. Mantener `copilot-rules.mjs` como camino local completo y revisar sus alertas ilustrativas de viento/polvo y GO/NO-GO para no convertirlas en fenómenos demostrados o autorización operativa.

Gemini es una opción por servidor con configuración explícita y respaldo local ante fallo. `grounded` comprueba rutas de contexto existentes, pero no demuestra por sí solo que cada afirmación esté sustentada: revisar coherencia entre texto, valores, fuente y limitaciones. No afirmar que los alias de modelos configurados siguen disponibles sin comprobarlo.

- **RAG:** solo si existe un corpus documental curado con necesidad real de búsqueda; conservar versión, fragmento y cita verificable. Con cuatro escenarios y contexto estructurado, pasar evidencia directa al copiloto es suficiente para empezar.
- **LangGraph:** solo si un flujo real de varios pasos requiere estado persistente, reintentos o intervención humana; una secuencia de cálculos y redacción no lo exige.
- **Fine tuning:** solo tras demostrar un error persistente que reglas/contexto no resuelven, disponer de dataset autorizado y evaluado y medir mejora en un conjunto independiente. No sustituye fuentes actualizadas ni modelos físicos.

**Aceptación/demo:** exportar el mismo núcleo de resultados sin IA ni red; verificar referencias y unidades; retirar un módulo y conservar un informe útil con la ausencia declarada. El texto generado opcional no puede alterar cifras, ocultar límites ni agregar conclusiones sin evidencia.

## Prioridad y secuencia del siguiente sprint

| Orden | Entrega mínima | Criterio de salida |
| --- | --- | --- |
| P0 · contrato | Acordar adaptador con el módulo 2 y metadatos de evidencia; conservar cuatro escenarios locales. | Candidato completo y caso con `null` atraviesan el flujo sin inventar valores. |
| P0 · módulo 5 | Informe determinista Markdown/JSON y estados parciales. | Demo sin claves ni servicios externos; auditoría del módulo 2 aparece con fuentes y límites. |
| P1 · módulo 1 | Lote regional pequeño, ranking explicable y selección de candidato. | Ranking reproducible, descartes trazables, candidato cargable sin romper escenarios existentes. |
| P1 · módulo 4 | Capa de pendiente regional con máscara y evidencia SAR existente. | Sin cobertura visible, sin promesas de cavidades o seguridad. Alimenta las limitaciones del informe. |
| P2 · módulo 3 | Serie local y ventanas exploratorias para una prueba definida. | Huecos y diferencias aire/superficie impiden resultados engañosos; criterios y tiempos reproducibles. |
| Posterior | Validación independiente y conectores reales opcionales. | Acceso, licencia, resolución, presupuesto y mejora medible confirmados antes de depender de ellos. |

La demostración del sprint selecciona candidato → ejecuta auditoría del módulo 2 → consulta capas disponibles → exporta expediente con limitaciones. Usar los checks locales existentes de JS y backend para la integración y agregar casos de contrato, unidades, ausencias y resultados deterministas según el código que se implemente; esta entrega es solo documental y no acredita ejecución de esos checks.

El usuario indicó una oferta de **Meteomatics de 1000 consultas/día durante el hackathon**; no se ha verificado como cuota general ni garantía vigente. El backend local tiene caché de 10 minutos y presupuesto por proceso: no es un límite compartido entre instancias o reinicios. Como cota ilustrativa, refrescar 15 sitios cada 10 minutos durante un día supondría 2160 consultas sin agrupar, antes de reintentos; limitar sitios activos y planificar caché/presupuesto, sin consultar clima por frame. Validar acceso, cómputo de consultas y duración de la oferta antes de depender de ella. Haiku y Devin son herramientas de desarrollo opcionales ofrecidas por el usuario, sujetas a disponibilidad, nunca requisitos del runtime; este trabajo no les envía código ni inicia sesiones.

## Fuentes locales revisadas

- [Arquitectura y entregables](../../docs/arquitectura_y_entregables_s_e_l_e_n_e_ops.md), [README de Atlas](../README.md), [contratos](contracts.md), [fuentes planetarias](targets-sources.md), [auditoría documental](source-audit.md) y [QA](qa.md).
- `app.js`, `mission.js`, `mission-math.mjs`, `sim-physics.mjs`, `similarity.mjs`, `copilot-rules.mjs`; `scripts/terrain_metrics.py`, `fetch-terrain.py`, `fetch-scenarios-earth.py` y `fetch-targets.py`.
- `server/main.py`, `telemetry.py`, `copilot.py`, `prompts/flight_director.md`, [README del servidor](../server/README.md), configuración de ejemplo y metadatos de las cuatro parejas en `assets/data/scenarios/`.
