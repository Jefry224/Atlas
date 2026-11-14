# A.R.E.S. Twin — estructura del pitch (6 diapositivas + cierre)

Equipo **ProdKillers** · NASA Space Apps Challenge 2026 · reto *Permanent Moon Base Locations and Mars*.
Duración objetivo: 5 minutos de pitch + 3 minutos de demo ([guion](demo-script.md)).

> Regla de honestidad para todo el deck: nunca decir «% de similitud planetaria» ni «en vivo» si el dato no lo es. Decir siempre «índice de similitud **geométrica**». Lo marcado **[pendiente de verificación]** depende de otros frentes y debe comprobarse en la build final antes de presentarlo; si no está, se elimina de la diapositiva.

---

## 1. Problema (≈ 40 s)

- Antes de enviar un rover o un hábitat a Shackleton o a Jezero, los equipos ensayan en análogos terrestres (Atacama, Lanzarote, Valles Secos…).
- Hoy la elección de análogos se apoya sobre todo en descripciones cualitativas y antecedentes: «es rocoso», «es árido». Son difíciles de comparar y de reproducir.
- Pregunta del reto: ¿qué lugares de la Tierra se parecen a los sitios candidatos de la Luna y Marte, **y en qué sentido**?

Mensaje clave: *elegir un análogo debería ser una decisión medible y explicable, no una intuición.*

## 2. Solución: A.R.E.S. Twin (≈ 50 s)

Consola tipo *Mission Control* que empareja un **gemelo digital terrestre** con un **objetivo extraterrestre** y permite:

1. Ver ambos relieves en 3D sobre la misma ventana estándar (2400 m × 2400 m, 65 × 65 nodos a 37,5 m).
2. Comparar métricas medidas de terreno con un **índice de similitud geométrica** explicable componente a componente.
3. Desplegar un rover virtual con física simplificada: actitud (pitch/roll) sobre el DEM, potencia solar, batería y estado térmico.
4. Preguntar a un **copiloto Flight Director** que redacta un informe GO / NO-GO con los números del contexto y su procedencia.

## 3. Datos y ecosistemas integrados (≈ 50 s)

| Capa | Fuente | Estado |
| --- | --- | --- |
| DEM terrestre | Copernicus DEM GLO-30 vía Microsoft Planetary Computer (STAC) | [pendiente de verificación: frente 1] |
| DEM Luna / Marte | NASA PDS, LOLA, HiRISE / MOLA según sitio | [pendiente de verificación: frente 2] |
| Térmica objetivo | LRO Diviner (Luna); literatura / modelo (Marte), etiquetado por `kind` | [pendiente de verificación: frente 2] |
| Telemetría terrestre | Meteomatics (o Open-Meteo como respaldo), con caché y snapshot sin red | [pendiente de verificación: frente 3] |
| Backend | FastAPI en contenedor (Cloud Run) | [pendiente de verificación: frente 3] |
| IA | Copiloto con Gemini / Anthropic si hay clave; reglas locales `rules-v1` siempre disponibles | Reglas locales: hecho. LLM: [pendiente de verificación: frente 3] |

Decir cuántos ecosistemas se integran **solo contando los que funcionen en la build final**; no prometer de antemano «8 ecosistemas». RADARSAT / Mini-RF (rugosidad radar) solo se menciona si hay datos con la misma unidad en ambos sitios; si no, se dice que queda fuera del índice.

## 4. Demo (≈ 3 min, ver guion)

Recorrido por los cuatro escenarios:

| Escenario | Tierra | Objetivo | Qué enseña |
| --- | --- | --- | --- |
| Tubo de lava volcánico | Lanzarote | Marius Hills (Luna) | Terreno basáltico, blindaje y estabilidad térmica |
| Cráter polar en sombra | Wright Valley | Shackleton (Luna) | Frío criogénico (Diviner) y potencia solar rasante |
| Planicie hiperárida y salina | Atacama | Jezero (Marte) | Aridez, polvo y muestreo |
| Cañón de erosión eólica | Wadi Rum | Valles Marineris (Marte) | Pendientes pronunciadas y viento |

## 5. Rigor y limitaciones (≈ 50 s) — la diapositiva que nos diferencia

- **Índice de similitud geométrica**, nunca planetaria. Componentes: pendiente p50 (30 %), pendiente p90 (25 %), desnivel p95–p5 (20 %), TRI medio (15 %), rugosidad radar (10 %, solo con la misma unidad en ambos sitios). Pesos editoriales, renormalizados entre los componentes disponibles; no calibrados.
- Cada componente: `100 · exp(−|ln(a/b)|)` (= cociente menor/mayor), simétrico y acotado; con un suelo mínimo para valores casi nulos.
- Mismas métricas para Tierra y objetivos: `scripts/terrain_metrics.py`. Si el DEM nativo es más grueso que 2× la rejilla (p. ej. MOLA), la comparación se marca **no comparable** y el índice queda como orientativo.
- La geometría no reproduce gravedad, regolito, iluminación ni química. El copiloto lo repite en cada informe.
- Física del rover: modelo de primer orden (rodadura + componente gravitatoria, eficiencia de tracción, `irradiancia × área × eficiencia × cos θ`). Umbrales GO / NO-GO ilustrativos.
- Todo dato lleva procedencia visible: en vivo / snapshot / literatura / modelo.
- Comprobaciones reproducibles: `npm run check` (sintaxis + tests `node --test`, sin dependencias).

## 6. Impacto (≈ 30 s)

- Ayuda a priorizar campañas de campo: qué análogo ensayar para qué riesgo (pendiente, frío, energía, polvo), con argumentos medibles.
- Formación y divulgación: cualquier persona puede «conducir» un rover sobre un análogo real y ver por qué falla en el objetivo.
- Abierto y reproducible: datos con licencia y procedencia, métricas en código abierto, funciona sin red como plan B.
- Siguiente paso: más ventanas por objetivo, análisis de sensibilidad de pesos y validación con equipos de campo.

## 7. Equipo ProdKillers y cierre (≈ 20 s)

- Integrantes y roles: *[completar nombres]* — datos Tierra, datos Luna/Marte, backend e infraestructura, frontend 3D/HUD, simulación, copiloto y pitch.
- Frase de cierre: «No buscamos el gemelo perfecto de la Luna o Marte; medimos en qué se parece cada análogo y en qué no, para ensayar lo que importa».
- Prototipo independiente: no implica afiliación ni aprobación de NASA.
