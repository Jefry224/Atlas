# Plan · refactor visual, calidad de imagen e interfaz en inglés

Estado: aprobado el 14-nov-2026. Criterio rector: **máximo impacto visual con el menor esfuerzo**.

## Prioridad acordada

1. **Iluminación base** (≈ 30 min) — mayor salto por menos esfuerzo.
2. **Shader de terreno** (≈ 45 min).
3. Interfaz «simulador primero» + inglés.
4. Calidad de imagen y relieve fino.
5. Cielo físico y post-procesado ligero (opcionales).

## Fase 0 · Cerrar el Módulo 3 (antes de todo)

- Integrar en la escena lo entregado por los agentes: `scene-fx.mjs` (cielo, sol real, partículas de clima, anillo de contexto), `solar.mjs`, `weather-sim.mjs` y `assets/data/scenarios/context/*`.
- Probar, commit en `feature/modulo-3-procesos` y merge a `main`.

## Fase 3a · Iluminación base — rama `feature/lighting` (prioridad 1)

- Tone mapping ACES + `outputColorSpace = SRGBColorSpace` y texturas en sRGB (hoy los colores se ven lavados).
- Luz ambiente/hemisférica teñida por el color del cielo de cada cuerpo y hora.
- Sombra del rover sobre el terreno (shadow map pequeño, PCF suave, solo el rover proyecta).
- Intensidad del sol según elevación real y clima (`solarFactor`).

## Fase 3b · Shader de terreno (prioridad 2)

- Micro-detalle procedural al acercarse (sin que se vea borroso).
- Tinte por pendiente: roca en laderas, polvo/arena en lo plano.
- Mapa de normales derivado del DEM.
- Escarcha o polvo acumulado según el clima simulado.
- Restricción: 50–60 FPS en vista dividida en una laptop media; sin SSAO ni efectos pesados.

## Fase 1 · Interfaz «simulador primero» + inglés — rama `feature/ui-simulator`

- 3D a alto completo; sin hero grande; barra superior delgada (logo · Moon | Mars · Sources).
- Columna izquierda en 3 pasos: Destination → Earth analog → Weather (chips de un clic).
- Barra inferior única: Energy · Thermal · Tilt · Similarity + play, auto/manual, cámara, pantalla completa.
- Cajón derecho con pestañas cerrado por defecto: Compare · Processes 72 h · Flight Director · Technical details · Sources.
- Radar, perfil y log a «Technical details»; perfiles y lista de 14 sitios a «Explore sites».
- Textos en `i18n.mjs` (EN por defecto, ES opcional); traducir textos generados por `processes.mjs`, `weather-sim.mjs`, `copilot-rules.mjs` y el prompt; actualizar tests.

Aceptación: se entiende sin scroll a 1440 px; cambiar clima o escenario en 1 clic; sin scroll horizontal a 320 px; tests en verde.

## Fase 2 · Calidad de imagen — rama `feature/hires-terrain`

| Qué | Cómo | Ganancia |
| --- | --- | --- |
| Texturas objetivo | Jezero HiRISE (25–50 cm) a 4096 px; Valles CTX 6 m a 2048–4096; Marius Kaguya 10 m; Shackleton LROC NAC si es viable | Muy alta |
| Textura Tierra | Sentinel-2 a 2048 px con mejor estiramiento (nativo 10 m) | Media |
| Relieve visual | Rejilla 257×257 solo para dibujar; el índice sigue en 65×65 | Alta |
| Carga progresiva | Ligera primero, 4K después | Evita esperas |

Riesgo: peso (≈ 3–6 MB por escenario en 4K) → JPEG q82, carga diferida.

## Fase 4 · QA y documentación

Capturas antes/después para el pitch, README en inglés, `docs/qa/qa.md`, guion de demo; revisión de 4 escenarios × climas × móvil.

## TODO · Climas plausibles por sitio (después del agente de contexto)

Hoy los 6 presets terrestres se ofrecen en cualquier sitio (permite «nieve en Lanzarote» o «haboob en la Antártida»). Marte y la Luna ya solo ofrecen fenómenos reales; no se agrega nieve en Marte porque solo ocurre en latitudes altas (CO₂ en los polos, nieve de agua vista por Phoenix), no en Jezero ni en Valles Marineris.

- Tabla de climatología por sitio en `weather-sim.mjs` (`SITE_CLIMATE[siteId] = { frequent: [...], occasional: [...] }`), para los 4 análogos de escenario y los 14 sitios del explorador.
- Preset nuevo **calima** (polvo sahariano) para Lanzarote/Canarias; viento **catabático** para Wright Valley.
- El selector de clima muestra solo lo plausible y rotula cada opción como «frecuente» u «ocasional/raro».

| Sitio | Frecuente | Ocasional / raro | No se ofrece |
| --- | --- | --- | --- |
| Lanzarote | Despejado, alisio | Calima, lluvia de invierno, ola de calor | Nieve, helada |
| Atacama | Despejado, helada nocturna | Viento con polvo, lluvia (rara, 2015), nevada en altura | Haboob |
| Wright Valley | Viento catabático, frío extremo | Nevada ligera | Lluvia, calor, haboob |
| Wadi Rum | Despejado, calor | Tormenta de polvo, helada invernal, lluvia torrencial (rara) | Nevada |
| Pampa de La Joya | Despejado | Viento con polvo | Lluvia, nieve |
| Haughton | Frío, nevada | Deshielo estival | Calor, haboob |

Esfuerzo: 20–30 min. Tests: cada sitio expone solo sus presets; ningún sitio ofrece un clima de su lista «no se ofrece».

## Decisiones pendientes

1. Inglés solo o EN/ES (recomendado EN/ES).
2. Mantener «Explore sites» con los 14 sitios o quitarlo hasta el Módulo 1.
