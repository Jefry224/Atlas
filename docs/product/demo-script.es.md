# A.R.E.S. Twin — guion de demo (3 minutos)

Objetivo: enseñar los cuatro escenarios, la simulación del rover, el índice de similitud geométrica y el copiloto, sin prometer nada que no esté en pantalla.

Lo marcado **[pendiente de verificación]** depende de otros frentes (datos, backend, frontend). Ensayar con la build final y, si algo falla, saltar a la línea del plan B.

## Antes de empezar (checklist, 5 min antes)

- [ ] `npm run check` en verde.
- [ ] Servidor local arrancado (`npm start` → `http://localhost:8000`) o URL desplegada abierta **[pendiente de verificación: dominio / Cloud Run]**.
- [ ] `GET /api/health` responde y muestra proveedor de clima e IA **[pendiente de verificación]**. Si `ai: "none"`, el copiloto usa reglas locales (es lo esperado; decirlo).
- [ ] Los 4 escenarios cargan rejilla Tierra + objetivo **[pendiente de verificación: frentes 1 y 2]**.
- [ ] Pestaña de respaldo abierta con la versión sin red (ver plan B).
- [ ] Preguntas del copiloto preparadas en un bloc para copiar y pegar.

## Guion (≈ 180 s)

| Tiempo | Pantalla | Qué decir / hacer |
| --- | --- | --- |
| 0:00–0:20 | Consola, escenario **Planicie hiperárida y salina** (Atacama ↔ Jezero) | «A la izquierda, Atacama con telemetría [en vivo / snapshot: leer la etiqueta real]; a la derecha, el cráter Jezero. Misma ventana de 2,4 km para los dos.» |
| 0:20–0:50 | Panel de similitud | Leer el índice y **un** componente. «Es un índice de similitud geométrica: pendientes, desnivel y rugosidad del terreno. No mide química ni gravedad, y lo decimos en la propia interfaz.» |
| 0:50–1:20 | Rover en Atacama (WASD o modo auto) | Conducir hacia una ladera. Señalar pitch/roll, potencia solar y batería. «La potencia sale de irradiancia × área × eficiencia × coseno; el consumo, de rodadura más pendiente.» |
| 1:20–1:50 | Copiloto | Preguntar: *«¿Cuál es el riesgo de falla térmica si desplegamos el rover aquí hoy?»*. Leer la recomendación y la procedencia citada (en vivo / snapshot / literatura). |
| 1:50–2:15 | Escenario **Cráter polar en sombra** (Wright Valley ↔ Shackleton) | «Aquí el análogo es frío, pero Shackleton está a decenas de kelvin según LRO Diviner [pendiente de verificación: dato del frente 2].» Preguntar al copiloto: *«¿Y la energía solar?»* → cota superior y aviso de Sol rasante. |
| 2:15–2:35 | Escenario **Cañón de erosión eólica** (Wadi Rum ↔ Valles Marineris) | Mostrar pendiente p90 y alerta de inclinación. Si Valles Marineris sale **no comparable** (DEM grueso), enseñarlo: «Cuando la resolución no da, lo marcamos». |
| 2:35–2:50 | Escenario **Tubo de lava volcánico** (Lanzarote ↔ Marius Hills) | Vistazo rápido: terreno basáltico; foco en blindaje y estabilidad térmica. No afirmar que se modela el interior del tubo. |
| 2:50–3:00 | Cierre | «Cuatro gemelos, métricas reproducibles y un copiloto que dice de dónde sale cada número.» |

## Preguntas preparadas para el copiloto

- «¿Cuál es el riesgo de falla térmica si desplegamos el rover en este análogo hoy?»
- «¿Nos alcanza la batería con el sol de hoy?» / «battery and solar power?»
- «¿Hay riesgo de vuelco en esta pendiente?»
- «¿Cómo afecta el viento y el polvo?»
- «¿Qué tan parecido es este terreno al objetivo?»
- «Dame un resumen GO / NO-GO.»

## Plan B sin red

1. **Sin backend o sin internet:** el frontend usa `assets/data/telemetry-snapshot.json` **[pendiente de verificación: frente 3]**. Decir en voz alta: «Esto es un snapshot guardado, no telemetría en vivo»; la etiqueta de procedencia lo muestra.
2. **Sin clave de IA o `/api/copilot` → 503:** el copiloto responde con `copilot-rules.mjs` (`provider: rules`, `model: rules-v1`). Funciona sin red y solo usa números del contexto. Decir: «Ahora responde el motor de reglas local».
3. **Sin servidor local:** abrir la carpeta con `python3 -m http.server 8000` desde el portátil; los escenarios y rejillas son JSON estáticos del repositorio **[pendiente de verificación: que los 8 JSON de rejilla estén en `assets/data/scenarios/`]**.
4. **Si falla el 3D:** enseñar el panel de similitud y el copiloto; contar la simulación con los números del HUD o con una captura preparada.
5. **Último recurso:** vídeo grabado de la demo completa (grabarlo tras el último ensayo).

## Lo que NO hay que decir

- «% de similitud planetaria», «réplica de Marte», «validado por NASA».
- «En vivo» sobre un dato con etiqueta snapshot, literatura o modelo.
- Cifras de ecosistemas integrados que no aparezcan funcionando en la build final.
