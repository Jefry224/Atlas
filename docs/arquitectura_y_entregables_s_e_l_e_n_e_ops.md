# S.E.L.E.N.E. Ops: Surface Exploration, Lithology & Environment Network Engine

**Equipo:** ProdKillers

**Reto:** NASA Space Apps Challenge — *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

## 1. Visión del Sistema y Núcleo Unificador

Para responder con rigor científico a las exigencias del reto de la NASA, la arquitectura de **S.E.L.E.N.E. Ops** se divide en **5 módulos verticales profundos** (uno por cada integrante del equipo). En lugar de crear simuladores aislados o repetir sitios terrestres clichés, todos los módulos parten de un mismo núcleo de datos geoespaciales para descubrir micro-entornos inéditos, auditar sus límites físicos y validar operaciones de exploración.

### El Contrato de Candidato Análogo (`CandidateAnalogPayload`)

Desde la hora cero, todo el equipo trabaja sobre un contrato de datos único en formato JSON. El sistema selecciona un objetivo extraterrestre (Luna o Marte con datos de **NASA PDS / LRO**), identifica micro-sitios terrestres candidatos (celdas de $1\text{ km}^2$ a $10\text{ km}^2$) y los somete a **5 auditorías técnicas independientes** cuyos resultados se consolidan en la consola central.

## 2. Distribución de los 5 Módulos Científico-Operativos (Sprint 24 Horas)

### Módulo 1: Motor de Descubrimiento de "Análogos Ocultos"

* **Responsable:** Integrante 1 (*Global Hidden-Site Hunter*)

* **Enfoque del reto:** *"Look beyond well-known analog sites... search globally and systematically for previously unrecognized analogs... Consider scale."*

* **Implementación:**

  * **Buscador Multi-Escala con Embeddings Geoespaciales:** Pipeline en Python con **Microsoft Planetary Computer (STAC API)**, **ALOS DEM** y **JAXA G-Portal** que divide regiones poco exploradas (cadenas volcánicas centroamericanas, valles altos andinos, cuencas de Asia Central) en celdas de $2 \times 2\text{ km}$.

  * **Ranking Dinámico de Similitud:** Calcula vectores de rugosidad topográfica, amplitud térmica diaria, aridez y pendiente para rankear los Top 5 micro-lugares inéditos en la Tierra que mejor replican un punto específico de la Luna o Marte.

### Módulo 2: Auditor de "Ruptura de Analogía" y Física Correctiva

* **Responsable:** Integrante 2 (*Analogy Breakdown & Calibration*)

* **Enfoque del reto:** *"Explain which characteristics provide a strong analogy, where the analogy breaks down... Earth cannot reproduce reduced gravity, vacuum, or radiation."*

* **Implementación:**

  * **Matriz de Validez Científica (Strength vs. Breakdown):** Diagnóstico técnico automático que separa qué parámetros físicos son válidos en el sitio terrestre y cuáles fallan debido a las condiciones terrestres.

  * **Calculadora de Compensación de Ingeniería:** Determina los factores de escala necesarios para probar instrumentos (taladros de hielo, ruedas de rover), compensando diferencias entre la gravedad terrestre ($1g$) y la lunar ($0.16g$) o marciana ($0.38g$), la presión atmosférica (**Meteomatics** vs. vacío lunar) y la transferencia térmica por convección.

### Módulo 3: Simulador de Procesos Dinámicos (Polvo, Viento y Ciclos Térmicos)

* **Responsable:** Integrante 3 (*Active Process Simulator*)

* **Enfoque del reto:** *"Think about processes as well as places. Earth processes such as sedimentation, dust storms, erosion, ice dynamics..."*

* **Implementación:**

  * **Comparador de Procesos Activos en Tiempo Real:** Conecta la API en vivo de **Meteomatics** (ráfagas de viento, irradiancia solar, temperatura del suelo) y series históricas de **Copernicus Sentinel / RADARSAT** para detectar eventos dinámicos activos como saltación de arena o congelamiento rápido nocturno.

  * **Ventana de Oportunidad de Pruebas (Live Test Window):** Pronóstico de 72 horas que indica a qué hora exacta el análogo terrestre replica las curvas de calentamiento/enfriamiento de **LRO Diviner** o las tormentas de polvo marcianas.

### Módulo 4: Subsurface & Hazard Mapper (Radar SAR y Subsuelo)

* **Responsable:** Integrante 4 (*Radar & Subsurface Ops*)

* **Enfoque del reto:** *"Explore the whole Earth, including below its surface... caves, lava tubes... Conditions relevant to landing, mobility, navigation."*

* **Implementación:**

  * **Fusión Radar Tierra-Espacio:** Procesamiento de datos **CSA RADARSAT-1 / RCM** en Python para detectar anomalías de retrodispersión, humedad subsuperficial y colapsos de tubos de lava o cavernas, cruzándolos con **LRO Mini-RF**.

  * **Evaluador de Riesgo de Aterrizaje y Navegación:** Mapa de obstáculos a micro-escala (pendientes críticas $> 15^\circ$, rocas afiladas, sombras permanentes) para entrenar sistemas de aterrizaje autónomo y navegación subterránea sin GPS.

### Módulo 5: Mission Control HUD, Gemelo 3D y "AI Mission Planner"

* **Responsable:** Integrante 5 (*Core Orchestrator & AI*)

* **Enfoque del reto:** *"Present your findings as a map, visualization, or other tool... Document your findings to share and educate."*

* **Implementación:**

  * **Interfaz Dual-Globe 3D (CesiumJS / Three.js):** Consola central estilo control de misión con capas conmutables que visualizan los outputs de los otros 4 módulos sobre relieve 3D sincronizado entre Tierra y Luna/Marte.

  * **Generador Automático de "Mission Analog Dossier":** Sistema multi-agente en **Vertex AI / Azure OpenAI** que sintetiza los cálculos de los 4 módulos y redacta un expediente científico descargable detallando qué instrumentos probar, qué parámetros físicos corregir y cuándo desplegar equipos en campo.

## 3. Alineación Estratégica con los Criterios Oficiales de la NASA

| Criterio Oficial del Reto | Módulo Responsable | Solución Técnica y Fuentes de Datos | 
| ----- | ----- | ----- | 
| **No repetir sitios clichés** | Módulo 1 (Discovery) | Búsqueda cuantitativa en celdas de $2 \times 2\text{ km}$ mediante Planetary Computer STAC API, ALOS DEM y JAXA G-Portal. | 
| **Límites físicos de la Tierra** | Módulo 2 (Breakdown) | Auditoría de ruptura por gravedad, vacío y radiación con cálculo de factores de escala para equipos de prueba. | 
| **Procesos vs. Fotos estáticas** | Módulo 3 (Procesos) | Telemetría climática en vivo (Meteomatics) cruzada con series temporales de Sentinel y curvas térmicas LRO Diviner. | 
| **Subsuelo y riesgos operativos** | Módulo 4 (Radar SAR) | Fusión de radar de apertura sintética (CSA RADARSAT-1/RCM + LRO Mini-RF) para tubos de lava y pendientes críticas. | 
| **Visualización y documentación** | Módulo 5 (Mission HUD) | Visor 3D sincronizado y generación automatizada de reportes científicos ejecutivos mediante agentes de IA en la nube. | 

## 4. Definición del Entregable Final

### A. El Producto Vivo (Flujo de Usuario de Punta a Punta)

Una **aplicación web interactiva desplegada en la nube** (ej. `https://seleneops.space` con dominio GoDaddy + SSL, alojada en Google Cloud Run / Azure App Service) que sigue este flujo:

1. **Selección del Objetivo Espacial:** El usuario elige un punto de interés real para una futura base en la Luna o Marte (ej. Cráter Shackleton o Marius Hills), visualizando su topografía y temperatura real (**NASA LRO Diviner / PDS**).

2. **Descubrimiento del Análogo Terrestre (Módulo 1):** El sistema rankea y muestra los **micro-sitios inéditos en la Tierra** que mejor empatan matemáticamente con ese objetivo en un visor 3D sincronizado (*Split-Globe*).

3. **Auditoría Técnica en Tiempo Real (Módulos 2, 3 y 4):** Con un clic en las pestañas del panel, se inspecciona:

   * **Ruptura de Analogía (Módulo 2):** Qué tan diferente es la gravedad/atmósfera terrestre ahí y qué factor de corrección necesita un equipo de ingeniería para probar un instrumento.

   * **Clima y Procesos en Vivo (Módulo 3):** Telemetría actual de *Meteomatics* indicando si en las próximas 72 horas hay una ventana climática óptima para probar equipos en campo.

   * **Riesgos y Subsuelo (Módulo 4):** Mapa de radar (*RADARSAT / Mini-RF*) mostrando rugosidad del suelo, rocas peligrosas o posibles tubos de lava subterráneos.

4. **Descarga del Expediente Científico (Módulo 5):** El usuario presiona *"Generar Mission Analog Dossier"* y el agente de IA sintetiza todos los cálculos anteriores para descargar un **reporte técnico en PDF/Markdown** listo para un equipo de misión.

### B. Paquete Oficial para la Plataforma NASA Space Apps

1. **Live Demo URL:** Enlace funcional desplegado en la nube (`seleneops.space`) sin necesidad de instalación local.

2. **Repositorio Público en GitHub:** Código fuente documentado (Frontend React, Backend FastAPI, pipelines de datos Python) con un `README.md` detallando los datasets utilizados (NASA, CSA, ESA, JAXA).

3. **Video Demo / Pitch:** Grabación mostrando la herramienta en funcionamiento de punta a punta y explicando el rigor científico de los módulos.

4. **Resumen Ejecutivo (Project Summary):** Ficha oficial en la plataforma de Space Apps detallando el problema, la arquitectura y los recursos integrados.

## 5. Protocolo de Sincronización del Equipo (Reglas de Integración)

* \[ \] **Mocks Inmediatos (Hora 1):** El Integrante 5 publica el esquema JSON base (`mock_analog_payload.json`) con datos de prueba para que los Integrantes 1, 2, 3 y 4 desarrollen sus motores en paralelo sin bloqueos por APIs externas.

* \[ \] **Desacoplamiento por Contenedores:** Cada módulo vive como un servicio/componente independiente que recibe exclusivamente el objeto del sitio candidato y devuelve su capa analítica y métricas estructuradas.

* \[ \] **Aceleración con Agentes de Código:** Uso de **Devin** para delegar pipelines asíncronos (extracción STAC, procesamiento SAR en NumPy, conectores REST) y **Codex** para iteración rápida sobre la interfaz 3D y visualización en tiempo real.