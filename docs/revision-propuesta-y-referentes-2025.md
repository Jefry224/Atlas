# S.E.L.E.N.E. Ops

## Plan para finalizar el MVP completo

**Equipo:** ProdKillers · **Fecha:** 14 de noviembre de 2026 · **Versión:** 2.0

Plan de finalización e integración de los cinco módulos, con tres candidatos sugeridos a partir de los datos disponibles y aprendizajes de nueve proyectos de Space Apps 2025. Las actividades descritas como pendientes son propuestas de implementación.

### Acuerdo de alcance

**Se conserva el alcance amplio de la propuesta:** descubrimiento global y multiescala, ranking y embeddings geoespaciales, auditoría física, procesos dinámicos, ventanas de 72 horas, SAR y subsuelo, riesgos operativos, visor 3D, planificación asistida por IA y expediente científico exportable.

Los tres candidatos permiten evaluar el sistema completo y organizar la demostración. El buscador mantiene su alcance global, el catálogo sigue disponible y los cuatro escenarios actuales se conservan. La secuencia de trabajo describe cómo integrar las capacidades y comprobar que funcionan.

### Visión del producto terminado

> S.E.L.E.N.E. descubre, compara y evalúa análogos terrestres para operaciones lunares y marcianas; integra terreno, ambiente, procesos y subsuelo, explica las diferencias físicas y genera un plan de ensayo trazable.

### Tres candidatos sugeridos

1. **Lanzarote / Caldera Blanca ↔ Marius Hills:** terreno volcánico, contexto de cavidades, geología y operaciones lunares.
2. **Wright Valley ↔ borde de Shackleton:** entorno frío y seco, relieve polar, iluminación y contraste térmico.
3. **Atacama / entorno ARADS ↔ Jezero:** hiper-aridez documentada regionalmente, muestreo, perforación y operaciones marcianas.

Se eligen por diversidad de procesos y fuentes disponibles. Son referencias ya conocidas: los nuevos micro-sitios que encuentre el buscador necesitarán su propia revisión de antecedentes.

### Regla para dar el MVP por finalizado

Los cinco módulos deben producir resultados conectados al mismo candidato, con entradas, método, fuentes y estado verificables. Cada capacidad debe demostrarse donde sea aplicable. Un mensaje de “sin dato” resuelve una ausencia concreta, pero no sustituye implementar y demostrar la funcionalidad correspondiente.

Fuentes principales: [arquitectura](../../docs/arquitectura_y_entregables_s_e_l_e_n_e_ops.md), [challenge](challenge.md), [recomendaciones](recomendaciones-modulos.md), [contratos](contracts.md) y [módulo 2](modulo-2.md).

<!-- pagebreak -->

## 1. Qué debe entregar cada módulo

La arquitectura original organiza el producto en cinco frentes. Cada uno conserva sus funciones y entrega resultados consumibles por el visor, el planificador y el expediente.

| Módulo | Funcionalidad que se conserva | Evidencia de finalización |
| --- | --- | --- |
| 1 · Descubrimiento global | Búsqueda por región y objetivo; celdas multiescala; métricas físicas y embeddings; ranking Top 5 explicable. | Una búsqueda ejecutada devuelve candidatos geolocalizados, universo examinado, descartes, componentes y método versionado. |
| 2 · Auditoría y calibración | Matriz de semejanza/ruptura; gravedad, presión, térmica y aplicabilidad de rover, rueda o taladro. | Cambiar candidato o equipo actualiza cálculos, banco visual, historial y reporte sin mezclar sesiones ni hipótesis. |
| 3 · Procesos y ventanas | Clima actual e histórico; pronóstico de 72 h; análisis de viento, polvo, congelación y ciclos térmicos. | Series con emisión/validez, modelos de procesos parametrizados e intervalos de ensayo explicados y reproducibles. |
| 4 · SAR, subsuelo y riesgos | Análisis radar temporal; cavidades y tubos documentados o inferidos; pendientes, obstáculos, iluminación y navegación. | Capas georreferenciadas con resolución y evidencia; escenarios de navegación y validación de los detectores con referencias. |
| 5 · Mission Control e IA | Vista Tierra–Luna/Marte, capas, rover, planificación asistida, agentes de análisis y dossier PDF/Markdown/JSON. | Flujo completo en la web desplegada, resultados coherentes entre paneles y exportaciones, fuentes accesibles y video de demostración. |

### Base actual que debe aprovecharse

Atlas dispone de 14 fichas documentales, cuatro parejas Tierra–objetivo y rejillas comparables de 2.4 × 2.4 km. Ya existen comparación geométrica, vista sincronizada, simulación de rover y copiloto local con conexión opcional a proveedores externos.

El módulo 2 incorpora contrato v1.0.0, auditoría, banco visual, registro acotado de rover/clima y reportes JSON, Markdown y Excel según su documentación actual. Estos componentes son la base de integración. Quedan por conectar los resultados completos de descubrimiento, procesos y SAR al expediente general.

### Resultado común

Cada módulo debe entregar identidad del candidato, versión, entradas, resultados, unidades, fuentes, fechas, calidad y condiciones de uso. Los cálculos deterministas alimentan a los agentes de IA; el texto generado conserva cifras y referencias.

<!-- pagebreak -->

## 2. Tres candidatos basados en los datos actuales

Las siguientes parejas ya tienen archivos locales. Se proponen para evaluar el producto por complementariedad científica y disponibilidad de insumos; no constituyen un Top 3 calculado por el motor global.

### A. Lanzarote / Caldera Blanca ↔ Marius Hills

**Ventanas actuales:** Tierra 29.034°, −13.732°; Luna 14.091°, −56.777°. **Uso:** geología volcánica, selección de muestras, movilidad y preparación de operaciones vinculadas a cavidades.

**Datos disponibles:** GLO-30, imagen Sentinel-2 y Sentinel-1 RTC VV terrestre; DTM Kaguya de aproximadamente 33 m y térmica Diviner en Marius Hills. La curva local contiene 23 puntos horarios lunares.

**Trabajo para completar el caso:** añadir caracterización de materiales, serie ambiental y SAR temporal. Incorporar cartografía o geometría publicada de cavidades en un área identificada de Lanzarote. Registrar una ventana adicional si la cavidad queda fuera de Caldera Blanca.

**Interpretación:** el DEM lunar actual no resuelve el pozo; Diviner describe el entorno regional, no su interior. Los datos de superficie y de cueva deben conservar geometrías y fuentes distintas.

### B. Wright Valley ↔ borde de Shackleton

**Ventanas actuales:** Tierra −77.517°, 161.833°; Luna −89.78306°, −155.7435°. **Uso:** operaciones en frío y sequedad, navegación sobre pendientes y estudio de iluminación y contrastes térmicos.

**Datos disponibles:** GLO-30, Sentinel-2 y Sentinel-1 RTC HH; LRO LOLA, Diviner PRP y Mini-RF CPR en Shackleton. El CPR regional registrado es 0.605.

**Trabajo para completar el caso:** incorporar serie polar, térmica superficial terrestre y cálculo temporal de iluminación; analizar hielo/congelación con las variables necesarias. El producto terrestre elegido debe cubrir esa latitud.

**Interpretación:** el objetivo está en el borde, no en el fondo permanentemente sombreado. El mínimo y la curva térmica de ese producto son desconocidos; HH, VV y CPR requieren tratamientos propios.

### C. Atacama / entorno ARADS ↔ Jezero

**Ventanas actuales:** Tierra −24.102°, −70.138°; Marte 18.4447°, 77.4508°. **Uso:** muestreo, perforación, selección de rutas y evaluación ambiental de operaciones robóticas.

**Datos disponibles:** GLO-30, Sentinel-2 y Sentinel-1 RTC VV; DTM HiRISE de aproximadamente 1 m de origen, remuestreado para comparación, y curva superficial de 24 puntos de Mars Climate Database.

**Trabajo para completar el caso:** añadir materiales/sales con evidencia espacial, variables de polvo y pronóstico de 72 h. Complementar MCD con mediciones de misión cuando el producto y la cobertura sean adecuados.

**Interpretación:** MCD es modelo; la posición terrestre es orientativa y no identifica una perforación exacta. La grilla común no conserva obstáculos de un metro del DTM original.

<!-- pagebreak -->

## 3. Datos y evidencia para completar la amplitud

Los tres casos comparten rejilla de 65 × 65 nodos a 37.5 m. Las métricas siguientes proceden de sus JSON locales; p90 resume el percentil 90 de pendiente y el desnivel es p95–p5 de elevación.

| Pareja | Tierra: p90 / desnivel | Objetivo: p90 / desnivel |
| --- | --- | --- |
| Caldera Blanca ↔ Marius Hills | 30.93° / 205.38 m | 5.46° / 58.47 m |
| Wright Valley ↔ Shackleton | 25.54° / 367.00 m | 31.60° / 541.82 m |
| Atacama ↔ Jezero | 15.86° / 142.90 m | 4.32° / 47.41 m |

Estas diferencias sirven para probar la auditoría y explicar en qué operaciones aporta cada sitio. No se interpretan como porcentajes de equivalencia planetaria. Wadi Rum–Coprates sigue disponible como cuarto escenario de cañón y navegación; la selección de tres no elimina datos ni funciones.

### Adquisición y preparación que falta cerrar

| Capacidad | Cómo completar los insumos |
| --- | --- |
| Búsqueda global y multiescala | Indexar regiones/celdas con cobertura, geometría y métricas; preparar embeddings con modelo y versión. Conectar STAC, ALOS y G-Portal mediante productos identificados. |
| NASA en caracterización terrestre | Incorporar variables NASA usadas en el análisis. Evaluar ECOSTRESS LST donde tenga cobertura; seleccionar un producto polar específico para Wright Valley. |
| Clima y procesos | Obtener histórico y pronóstico de 72 h, unidades, emisión y validez. Añadir propiedades de materiales y condiciones del suelo requeridas por cada proceso. |
| Radar Tierra–espacio | Preparar series Sentinel-1 y productos RADARSAT-1/RCM con acceso y cobertura comprobados. Mantener Mini-RF en su magnitud y soporte propios. |
| Cavidades y subsuelo | Añadir inventarios publicados, geometrías y evidencia independiente. Incorporar radar de sondeo o campo si se pretende validar estructura bajo superficie. |
| Riesgos y navegación | Conservar DEM multiescala; obtener imágenes/geometrías de detalle para obstáculos y efemérides para iluminación. Documentar el vehículo y sus umbrales. |

Cada fuente se acredita con producto identificado, procesamiento ejecutado y resultado visible. Resolver acceso y cobertura forma parte de la implementación.

Fuentes: [escenarios](../assets/data/scenarios.json), [productos planetarios](targets-sources.md) y [ECOSTRESS LST](https://doi.org/10.5067/ECOSTRESS/ECO_L2T_LSTE.003).

<!-- pagebreak -->

## 4. Finalizar descubrimiento y auditoría

### Módulo 1 · Global Hidden-Site Hunter

1. **Construir el índice geográfico.** Dividir áreas en celdas identificables, conservar polígonos, CRS y soporte de cada variable. Permitir varias escalas; las parejas actuales aportan una escala de evaluación conocida.
2. **Preparar atributos y embeddings.** Calcular pendiente, relieve y rugosidad geométrica con una receta compartida. Añadir materiales, aridez y térmica cuando estén respaldados. Registrar modelo, versión y datos de entrada de los embeddings.
3. **Implementar recuperación y reranking.** Recuperar candidatos por similitud y recalcular su utilidad según operación: movilidad, muestreo, térmica o subsuelo. Mostrar métricas físicas y contribución del embedding sin confundirlas con una probabilidad de éxito.
4. **Conectar la búsqueda a Mission Control.** Devolver Top 5 con mapa, fuentes, cobertura y descartes. Abrir cualquiera como candidato de los módulos 2–5, con el mismo ID durante todo el recorrido.
5. **Evaluar el método.** Usar las tres parejas sugeridas como casos de referencia; buscar micro-sitios adicionales y revisar antecedentes. Comparar recuperación con/sin embeddings, variación de pesos y regiones reservadas para evaluación.

**Cierre funcional:** una consulta nueva ejecuta búsqueda y produce candidatos evaluables. Debe quedar visible qué territorio se examinó; una cobertura parcial no se presenta como barrido exhaustivo del planeta.

### Módulo 2 · Analogy Breakdown & Calibration

1. **Reutilizar la implementación actual.** Adoptar `CandidateAnalogPayload`, matriz, cálculo, banco visual y sesiones existentes. Conectar candidatos dinámicos además de los escenarios predefinidos.
2. **Completar perfiles de instrumento.** Parametrizar rover, rueda y taladro con masa/carga, geometría y condiciones de ensayo. Mantener separados los parámetros de misión y las hipótesis manuales.
3. **Integrar salidas científicas.** Incorporar propiedades del material, ambiente, procesos e incertidumbres procedentes de los módulos 1, 3 y 4. La matriz debe enlazar cada conclusión con su evidencia.
4. **Relacionar modelos de ensayo.** Mantener carga estática, presión y transferencia térmica; añadir escalas dinámicas o terramecánica mediante un modelo definido y evaluado para el equipo correspondiente.
5. **Sincronizar reporte e IA.** Compartir el mismo corte de datos con paneles, agentes, historial y exportaciones. Actualizar meteorología sin mezclar candidatos o convertir caché en una nueva observación.

**Cierre funcional:** las tres parejas pasan por auditoría y configuración de equipos; cada resultado conserva unidades, supuestos y origen. Las diferencias de gravedad, vacío o radiación se traducen en condiciones de ensayo y procedimientos específicos.

Referencias de implementación: [contratos](contracts.md), [módulo 2](modulo-2.md), [auditoría](../analog-audit.mjs), [similitud](../similarity.mjs) y [métricas de terreno](../scripts/terrain_metrics.py).

<!-- pagebreak -->

## 5. Finalizar procesos, subsuelo y operaciones

### Módulo 3 · Active Process Simulator

1. **Completar el conector temporal.** Consultar clima actual, histórico y pronóstico horario de 72 h. Conservar coordenadas, emisión, instante de validez, modelo, altura/profundidad y unidades; cachear por sitio y período.
2. **Construir los modelos de procesos.** Para polvo/saltación: grano, densidad, humedad y esfuerzo umbral. Para congelación: estado del agua/suelo y balance térmico. Para calentamiento/enfriamiento: material, irradiancia, conducción, convección y radiación.
3. **Integrar las referencias planetarias.** Usar Diviner y MCD según su naturaleza, escala y período; incorporar productos adicionales para cubrir huecos. Preservar duración física y fase del ciclo terrestre, lunar o marciano.
4. **Calcular ventanas por ensayo.** Definir variables objetivo, tolerancias, duración mínima y límites del instrumento. Mostrar intervalos, distancia a las condiciones buscadas, datos faltantes e incertidumbre del modelo.
5. **Evaluar eventos y predicción.** Contrastar resultados con observaciones/series independientes. Separar evento observado, proceso simulado y ventana pronosticada; publicar la evaluación correspondiente.

**Cierre funcional:** la línea de tiempo conecta datos en vivo y series con procesos calculados y ventanas de ensayo de 72 h. La serie meteorológica existente de M2 se reutiliza como registro; todavía hay que implementar el pronóstico y los modelos del módulo 3.

### Módulo 4 · Radar & Subsurface Ops

1. **Completar el pipeline SAR temporal.** Resolver acceso a Sentinel/RADARSAT, seleccionar adquisiciones compatibles y registrar calibración, órbita, incidencia, polarización, máscaras y correcciones de terreno.
2. **Integrar evidencias de subsuelo.** Vincular cavidades publicadas y sus geometrías, depresiones y anomalías radar. Entrenar/evaluar detectores con referencias independientes; mostrar por separado cavidad documentada e hipótesis inferida.
3. **Construir las capas de peligro.** Calcular pendientes; detectar bloques con datos que resuelvan su tamaño; modelar iluminación/sombras a lo largo del tiempo. Relacionar cada umbral con el vehículo.
4. **Resolver navegación superficial y subterránea.** Añadir planificación de rutas y una escena de cavidad con geometría documentada o simulada explícitamente. Evaluar navegación sin GPS bajo los supuestos del escenario.
5. **Conectar procesos y auditoría.** Enviar al módulo 3 los cambios observados y al módulo 2 la evidencia de materiales/subsuelo; publicar capas y resultados en el módulo 5.

**Cierre funcional:** mapa SAR, evaluación de peligros y recorrido de navegación operativos. La demostración de subsuelo identifica su evidencia; una cavidad simulada no se presenta como levantamiento real. La estructura o profundidad subterránea requiere evidencia que la resuelva.

<!-- pagebreak -->

## 6. Integrar Mission Control y cerrar la entrega

### Módulo 5 · HUD, 3D, agentes y expediente

**Consola:** integrar búsqueda, lista de candidatos, globos y terrenos sincronizados, selector multiescala, capas SAR/ambiente/peligros/subsuelo, línea de tiempo de 72 h y resultados del rover. Elegir un candidato debe actualizar todos los módulos de forma coherente.

**Planificador y agentes:** orquestar funciones de descubrimiento, auditoría, procesos y radar; un agente de síntesis compone el plan de ensayo y un paso de verificación comprueba cifras y citas. Los agentes consumen herramientas deterministas para cálculos. El contexto incluye versión, fuentes, ausencias e incertidumbre.

**Expediente completo:** objetivo y candidato; ranking y búsqueda; auditoría física; procesos y ventanas; riesgos, cavidades y rutas; equipo, hipótesis, fuentes, fechas y validación pendiente. Exportar PDF, Markdown y JSON; mantener el Excel de sesión existente como complemento.

### Secuencia de integración con los cinco frentes

| Ronda | Trabajo coordinado | Salida comprobable |
| --- | --- | --- |
| 1 · Contratos y datos | Cada frente define su salida sobre el candidato común. Inventariar accesos, productos y huecos de los tres casos. | Esquemas, manifiestos y paquetes de datos con fuentes; dependencias asignadas. |
| 2 · Motores y conectores | Ejecutar búsqueda/embeddings, auditoría, pronóstico/procesos y SAR/navegación sobre los contratos. | Resultados reproducibles por módulo y errores de datos explícitos. |
| 3 · Integración completa | Conectar motores al HUD, agentes, historial y expediente. Añadir actualización, caché y manejo de fallos. | Cambiar de candidato actualiza todas las vistas y exportaciones. |
| 4 · Evaluación y publicación | Recorrer los tres casos, corregir fallos, ejecutar QA y desplegar la aplicación. Preparar repositorio, video, pitch y ficha. | URL funcional, artefactos consistentes y evidencia del recorrido completo. |

Las rondas expresan dependencias, no una garantía de duración. La estimación se cierra al comprobar accesos, volumen de procesamiento y tareas de cada frente.

### Demostración del MVP amplio

Buscar candidatos → comparar tres sugerencias → abrir una pareja → ejecutar auditoría → consultar procesos y ventana de 72 h → activar SAR, subsuelo y peligros → simular navegación → generar el plan con IA → descargar el expediente.

**Aceptación transversal:** demostrar una consulta nueva, los tres casos de evaluación, una actualización temporal, un caso con datos faltantes y coherencia entre interfaz y reportes. Cada capacidad debe tener al menos un caso de aplicación demostrado, además del manejo de ausencias.

<!-- pagebreak -->

## 7. Qué incorporar de los nueve referentes

Estas aplicaciones aportan patrones para completar la amplitud del producto. Las funciones descritas por los equipos son referencias; su transferencia debe evaluarse en S.E.L.E.N.E.

| Referente | Aporte aprovechable | Aplicación al MVP completo |
| --- | --- | --- |
| [PureFlow](https://www.spaceappschallenge.org/2025/find-a-team/pureflow2/?tab=project) | Configuración guiada, visualización y consecuencias de ingeniería. | Unificar equipo, hipótesis, simulación 3D y resultado de ensayo. [Demo](https://larasdiniz.github.io/PureFlow-2025/src/public/html/home/home.html). |
| [Twisters / SkySense](https://www.spaceappschallenge.org/2025/find-a-team/twisters/?tab=project) | Ventanas meteorológicas para actividades. | Pronóstico de 72 h asociado al instrumento, alertas e interacción con el planificador. |
| [TengriSpacers](https://www.spaceappschallenge.org/2025/find-a-team/tengrispacers/?tab=project) | Descarga, procesamiento, series SAR y exportación. | Workers geoespaciales reproducibles y comparación temporal con valores científicos conservados. |
| [GRIT-X Awa](https://www.spaceappschallenge.org/2025/find-a-team/grit-x-awa/?tab=project) | Validación de entradas, análisis, vista pública y científica. | Importar candidatos por contrato; evaluar modelos y ofrecer explicaciones en dos niveles. |
| [Photonics Odyssey / AakashNet](https://www.spaceappschallenge.org/2025/find-a-team/photonic-force/?tab=project) | Problema territorial y arquitectura modular. | Relacionar cobertura global, necesidades de misión, restricciones y escalabilidad. |
| [CloudMap / AirWatch Pro](https://www.spaceappschallenge.org/2025/find-a-team/cloudmap/?tab=project) | Fuentes múltiples, gráficos, alertas y exportación. | Panel integrado con estado de fuentes, resultados temporales y calidad por capa. |
| [TechNova / Meteor Madness](https://www.spaceappschallenge.org/2025/find-a-team/technova3/?tab=project) | Aprender, simular y decidir con parámetros visibles. | Recorrido “Explorar → Comparar → Preparar ensayo” con simulación y decisiones explicadas. |
| [Titan / Pale Blue Dot](https://www.spaceappschallenge.org/2025/find-a-team/titan46/?tab=project) | Narrativa inmersiva desde el espacio hasta procesos terrestres. | Briefing 3D y narración de la misión conectados a datos y capas. |
| [Zumorroda-X](https://www.spaceappschallenge.org/2025/find-a-team/zumorroda-x/?tab=project) | Casos locales, imágenes comparadas y decisiones interactivas. | Misiones educativas para comparar candidatos y entender procesos y ruptura de analogía. |

### Reutilización y fuentes

[GRIT-X-Awa declara MIT](https://github.com/GRITX-AWA/GRIT-X-Awa/blob/main/LICENSE). En las raíces revisadas de [PureFlow](https://github.com/larasdiniz/PureFlow-2025) y [GlacierSAR](https://github.com/Apelsinovich/GlacierSAR-Kyrgyzstan) no se encontró `LICENSE`; aclarar permisos antes de incorporar código. El [conversor PNG revisado](https://github.com/Apelsinovich/GlacierSAR-Kyrgyzstan/blob/main/data_processing/sentinel1_to_png.py) ajusta contraste: conservar datos calibrados para análisis cuantitativo.

Este plan de finalización integral se apoya en la revisión de los nueve equipos y en documentos/JSON locales actualizados. No acredita ejecución de los motores pendientes, nuevas descargas científicas, despliegue o validación física. Actualizar arquitectura y recomendaciones para reflejar este acuerdo de alcance y el estado real de cada integración.
