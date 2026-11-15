# Atlas · modelo de descenso propulsado final v1.0.0

El motor calcula de forma determinista el **tramo propulsado final** sobre los DEM de los cuatro escenarios. En el flujo de producto solo desciende la nave del destino lunar o marciano; los perfiles terrestres se conservan como referencia del motor y para pruebas comparativas legacy. Conecta preparación regional, descenso, contacto simulado y posterior despliegue del rover. No reproduce órbita, entrada atmosférica, escudo térmico, paracaídas ni EDL completo. Tierra aporta un origen automático de ensayo en superficie y un rover de control; no requiere nave, selección de aterrizaje ni combustible. El espejo del destino es una simulación, sin enlace de hardware. Marte omite atmósfera, viento y aerodinámica; Luna supone vacío. No se importa el viento terrestre al objetivo.

La región científica, por defecto el centro local `(0,0)`, permanece distinta del punto de contacto. Una separación nominal de 300 m evita aterrizar por defecto en ese centro: es una regla propuesta de planificación, sin inventar el contorno de una cueva, pozo o pared. Solo el candidato objetivo es seleccionable en la preparación principal; el plan terrestre permanece de referencia. Compartir escenario no hace homólogas sus coordenadas ni sus contactos.

## Perfiles propuestos y trazabilidad

`landing-profiles.mjs` exporta `LANDING_PROFILE_VERSION`, `getLandingProfile(body)` y `validateLandingProfile(profile)`. Cada llamada devuelve una copia aislada de un `LandingProfile` 1.0.0, `kind: proposed-design`. Cuerpos admitidos: `earth`, `moon`, `mars`; un identificador no soportado produce `RangeError`. La validación devuelve `{valid, errors}`, sin coerción de nulos o cadenas numéricas, y exige un ID compatible con cuerpo/versión.

| Cantidad SI | Tierra | Luna | Marte |
| --- | ---: | ---: | ---: |
| ID | atlas-final-earth-v1 | atlas-final-moon-v1 | atlas-final-mars-v1 |
| Gravedad m/s², referencia `BODY_ENV` | 9.81 | 1.62 | 3.71 |
| Carga rover kg, `ROVER_CONFIG.massKg` | 350 | 350 | 350 |
| Nave seca adicional propuesta kg | 500 | 500 | 500 |
| Masa seca total propuesta kg | 850 | 850 | 850 |
| Propelente inicial propuesto kg | 650 | 180 | 260 |
| Masa inicial total kg | 1500 | 1030 | 1110 |
| Empuje máximo propuesto N | 22000 | 6000 | 10000 |
| Isp propuesto s | 305 | 305 | 305 |

Se comparan **configuraciones adaptadas por cuerpo**, con combustible y empuje distintos: la comparación no aísla la gravedad como única variable. Los 350 kg son la carga incluida dentro del presupuesto seco, y no la masa de la nave. No se infiere ninguna masa del aspecto o identidad de las mallas NASA.

El resto del perfil es común: `g0Ms2=9.80665`, `tiltMaxDeg=15`, altura inicial AGL 180 m, velocidad vertical inicial −6 m/s, desplazamiento inicial respecto al candidato `(60,−45)` m, descenso máximo 12 m/s, descenso final nominal 0.6 m/s, aceleración vertical de control máxima 3 m/s², aceleración de frenado de referencia 1.5 m/s² y aceleración lateral solicitada máxima 2 m/s². El empuje disponible y la inclinación pueden limitar esas aceleraciones.

Tolerancias propuestas de contacto: velocidad vertical relativa al suelo ≤1.2 m/s, horizontal ≤0.8 m/s, inclinación del empuje ≤8°, error respecto al candidato ≤12 m y pendiente interpolada local ≤12°. La selección regional exige pendiente P90 ≤12°, pendiente máxima muestreada ≤18° y desnivel ≤70 m. Límite de ensayo: 180 s. Son hipótesis del diseño, no tolerancias publicadas de un vehículo real.

El perfil exporta `assumptions`, `limitations` y `sources`. La referencia de gravedad procede de `BODY_ENV` compartido con la simulación existente. `g0` es la gravedad estándar usada para definir Isp, también en Luna/Marte; sustituirla por la gravedad local daría un consumo incorrecto. El motor es ideal y modulable de cero a máximo, con Isp constante y sin corrección de tobera por presión ambiente. No se modelan impulso mínimo, encendido, transitorios ni reservas operativas.

## Planificador regional

```js
const profile = getLandingProfile(grid.body);
const plan = evaluateLandingZones(grid, {
  sciencePoint: { x: 0, z: 0 }, profile,
});
const zone = plan.zones.find(z => z.id === plan.selectedId);
const state = createDescent({ profile, grid, zone });
```

`evaluateLandingZones(grid,{sciencePoint,profile})` devuelve un `LandingZonePlan` 1.0.0 con `gridId`, `body`, `profileId`, metadatos `grid` sin raster, `sciencePoint`, `zones`, `selectedId`, `scoring`, `limitations` y `errors`. DEM y perfil incompatibles, raster incompleto/no finito o un objetivo fuera de cobertura dejan `selectedId=null`. Se rechaza explícitamente una extensión declarada incompatible con nodos y paso. El motor no crea elevaciones de respaldo.

Busca centros cada dos pasos de rejilla, excluyendo tres celdas en cada borde y el círculo nominal científico. Cada vecindad tiene radio de tres pasos: 112.5 m y ancho 225 m en los DEM actuales de 37.5 m. Evalúa 49 posiciones del DEM bilineal; calcula pendiente de su gradiente, P90 y máximo de pendientes, y diferencia de altura máxima/mínima. Estas métricas son regionales, no un ajuste de patas ni una máscara de peligros. Las derivadas sobre un nodo usan la celda bilineal adyacente. Se exige cobertura completa y resolución nativa conocida ≤2 pasos; `metrics.comparable=false` impide seleccionar una región remuestreada demasiado gruesa.

Ordena primero candidatos elegibles, después score descendente y finalmente ID. Conserva hasta cinco regiones distintas, separando sus centros al menos un ancho de vecindad o 300 m, el mayor. Puede devolver menos si la ventana no permite esa separación. La primera elegible se selecciona. Si todas exceden pendientes/desnivel o faltan datos, se conserva evidencia y no se fuerza una selección.

Cada zona incluye `id,gridId,x,z,elevationM,slopeDeg,maxSlopeDeg,reliefM,scienceDistanceM,status,eligible,score,reason,scaleMeters,neighborhoodRadiusM,spacingMeters,nativeResolutionMeters,coverage,sciencePoint,georeference`. `status=candidate` exige pendiente y desnivel por debajo del 65% de sus límites; una región elegible cerca del límite queda `caution`. Una pendiente excesiva también queda `caution` con `eligible=false` y explicación; datos o resolución insuficientes quedan `unevaluable`. Para iniciar el ensayo hay que usar `selectedId` o verificar `eligible`, no basta `status`.

El score 0..100 es una heurística:

```text
100 · clamp(1 − 0.55·pendienteP90/límitePendiente
              − 0.35·desnivel/límiteDesnivel
              − 0.10·distanciaCientífica/extensiónDEM, 0, 1)
```

Los costes usan pendientes redondeadas a 0.1° y desniveles a 1 m, evitando ordenar por detalle milimétrico espurio; las métricas y límites conservan sus valores sin redondear. El score se redondea a una décima. No es probabilidad, similitud planetaria ni certificación. La posición elegida es estable frente al ruido milimétrico probado en los ocho DEM; no se garantiza estabilidad si un terreno está justo en un umbral o hay candidatos empatados.

La resolución nativa alta de un producto no recupera el detalle perdido en el remuestreo a 37.5 m. En particular, el pozo de Marius no está resuelto. En Shackleton, el LDEM nominal de 5 m contiene abundante interpolación entre huellas LOLA: `grid.notes` conserva ese aviso. Los metadatos del plan y resumen mantienen producto, fuente, fecha de captura, muestreo, notas y procedencia del archivo; no contienen su array de alturas.

## Física, control e integración

Ejes locales: `x` este, `z` sur, `yM` altura sobre el datum del producto. `altitudeM` es altura sobre el DEM justo debajo de la nave. Todo usa metros, segundos, kg, N y grados para ángulos públicos; radianes internamente. No entran el factor visual `U`, la exageración ×2 ni el tiempo ×20 del rover.

```text
m = masaSeca + propelente
W = m · g
a = vectorEmpuje / m − g · vertical
consumoKg/s = T / (Isp · g0)
```

El controlador lateral solicita `0.12·errorPosición − 0.85·velocidad`, acotado por eje y luego por el cono de inclinación. El vertical regula velocidad AGL con ganancia 2 s⁻¹; solicita aceleración entre caída libre y el máximo propuesto. Primero frena hacia una espera nominal a 40 m AGL mientras termina el desplazamiento lateral. Cuando error lateral ≤2 m y velocidad horizontal ≤0.3 m/s, pasa a `guidanceStage=terminal`. La velocidad de descenso solicitada es:

```text
alignment: −min(vMax, sqrt(2·aFrenado·max(AGL−40,0)))
terminal:  −min(vMax, sqrt(vFinal² + 2·aFrenado·max(AGL−1,0)))
```

La actitud sigue instantáneamente la dirección de empuje; no se integra dinámica rotacional ni contacto con patas. Esta simplificación y el conocimiento perfecto del estado/DEM son explícitos. `pitchDeg` corresponde a componente sur/vertical y `rollDeg` al negativo de este/vertical; no son actitud del rover sobre el suelo.

`stepDescent` divide el intervalo en subpasos ≤0.05 s. Integra posición con aceleración constante por subpaso y velocidad con la misma aceleración, usando masa media después del gasto de propelente. El impulso de cada subpaso se limita tanto por empuje máximo como por el combustible realmente disponible. Sin combustible no hay empuje. Un fallo de combustible o un presupuesto de empuje inicial incapaz de superar peso se registran en `faultCodes` e impiden un contacto exitoso. No se recarga combustible ni se ajustan velocidades al acercarse al suelo para fingir éxito.

La colisión se detecta contra la altura bilineal del DEM, no contra cero del mundo. Si el siguiente estado cruza el suelo, una bisección de 24 iteraciones localiza el primer contacto dentro de ese subpaso y conserva velocidad, posición y consumo hasta ese instante. La velocidad vertical de contacto es la magnitud de `vy − gradienteDEM·velocidadHorizontal`. La velocidad exportada de impacto se conserva, en lugar de sustituirse por cero. Al contacto el empuje queda apagado y termina la integración; no se simula el rebote, vuelco ni estabilización de patas.

Salir del DEM detiene el ensayo con `phase=aborted`, `outcome.code=outside-dem` y AGL desconocida (`null`); no se sujeta la nave a un borde extrapolado. `abortDescent` también detiene el ensayo sin propulsión de escape. Alcanzar el límite de tiempo produce aborto, sin éxito implícito.

## API de estados y exportación

```js
createDescent({ profile, grid, zone, initial? })
stepDescent(state, dt, { running = true } = {})
abortDescent(state, reason?)
summarizeDescent(state)
```

`createDescent` devuelve `phase=ready` y verifica nuevamente el terreno de la zona: no confía en pendientes, score o elegibilidad suministrados por el llamador. `initial` admite únicamente `x,z,altitudeM,verticalSpeedMs,vxMs,vzMs,propellantKg`, en SI; permite casos de fallo, no combustible mayor que el presupuesto. Las coordenadas iniciales son absolutas del DEM; por defecto usa los desplazamientos del perfil respecto a la zona. Metadatos de zona, perfil y raster se copian y congelan: mutar posteriormente el DEM cargado no altera el ensayo activo.

El primer paso positivo en marcha pasa de `ready` a `descent`. `dt` admite 0..60 segundos finitos; valores inválidos producen `unavailable`, sin inventar un intervalo. `running=false` y `dt=0` conservan tiempo/estado y devuelven un objeto nuevo. Cada paso devuelve un nuevo estado sin mutar el anterior. Los estados terminales `contact,hard-contact,aborted,unavailable` permanecen detenidos. Un `contact` solo afirma que todas las tolerancias del modelo y su condición de propulsión se cumplieron; `hard-contact` conserva los checks fallidos. No significa terreno seguro.

El estado interno conserva una copia inmutable del raster; **solo `summarizeDescent` se entrega a UI, historial y reporte**. Devuelve un `LandingRunSummary` 1.0.0 serializable, con esta lista explícita:

```text
body, profileId, phase, guidanceStage, simSeconds,
x, z, yM, altitudeM, groundElevationM,
verticalSpeedMs, horizontalSpeedMs, vxMs, vyMs, vzMs,
pitchDeg, rollDeg, thrustN, throttle, propellantKg, massKg,
gravityMs2, weightN, positionErrorM,
target, contact, profile, grid, georeference,
outcome, faultCodes, limits, limitations
```

`verticalSpeedMs` es `vyMs`, con signo positivo hacia arriba; `contact.verticalSpeedMs` es magnitud relativa al terreno. `contact` es `null` antes del impacto; después contiene `{verticalSpeedMs,horizontalSpeedMs,tiltDeg,positionErrorM,slopeDeg,withinTolerances,checks}`. `checks` tiene booleanos `verticalSpeed,horizontalSpeed,tilt,position,slope,propulsion`. `outcome={code,label,success}`, con `success=null` durante preparación/descenso, `true` en contacto dentro del modelo y `false` en fallos. `limits={verticalSpeedMs,horizontalSpeedMs,tiltDeg,positionErrorM,regionalSlopeDeg,regionalReliefM,maxSimSeconds,maxSubstepSeconds}`. Las ausencias son `null`, nunca ceros inventados.

La UI arma `LandingRunPayload` 1.0.0 por sesión según el contrato compartido: perfiles y planes de referencia, resumen del destino, hasta 1200 muestras y 300 eventos. En `missionMode: target-first`, `primarySide: target`, `runs.earth` y `history[].earth` son `null`: no hay vuelo terrestre. Debe muestrear a 2–5 Hz como máximo, conservar identidades de sesión/escenario y cerrar el ensayo antes de mover el rover. Las coordenadas del rover objetivo se trasladan desde **su propio** contacto; el rover terrestre es la autoridad de desplazamiento. `explorationOrigins.earth` es el centro `(0,0)` del DEM terrestre válido, con elevación interpolada y rol `analogue-test-origin`; no es un contacto ni una zona certificada. `explorationOrigins.target`, rol `target-contact`, existe solo tras el contacto SI calculado. El espejo aplica `contactoTarget + (roverEarth - origenEarth)` y cada suelo evalúa actitud/pendiente en su propio x,z. `mirrorAvailable` comunica disponibilidad de ambos orígenes; `targetPose` además valida cobertura. Sin Earth válido el vuelo target puede terminar y autorizar despliegue, con conducción espejo desactivada. Un fallo target siempre impide desplegar. `setOptions({timeScale,deploymentMode})` conserva 1× y autorización manual por defecto; `paired-legacy` es explícito para pruebas del comportamiento anterior. El motor no implementa esa política de UI, sesiones ni escritura de Excel.

## Georreferencia

Los targets declaran `sampling.frame` AEQD y `sampling.radiusMeters`: Luna 1 737 400 m y Marte **3 396 190 m**, los radios usados por `scripts/fetch-targets.py`. Se aplica la inversa AEQD esférica, también en Shackleton; una aproximación lineal en longitud cerca del polo daría errores materiales. Los DEM terrestres Copernicus documentan AEQD WGS84 en sus notas y `scripts/fetch-scenarios-earth.py:site_crs`; se invierte mediante la geodésica directa de Vincenty, sin dependencia de PROJ en ejecución. Otros DEM terrestres pueden declarar explícitamente `sampling.ellipsoid=WGS84`.

`georeference={latitude,longitude,kind:'model-projection-inverse',method,reference,limitation}`. Devuelve `null` si falta centro o marco verificable, o si no converge. Son coordenadas derivadas de la proyección del DEM; sus decimales no expresan precisión instrumental ni validan la posición del pozo o de una huella de nave real. Los centros y fechas son los del archivo cargado, sin atribuirlos a observaciones en vivo.

Se contrastó un punto `(x=1000,z=−500)` m por cada uno de los ocho DEM con `pyproj.Transformer`/PROJ independiente. Los tests fijan esos resultados con tolerancia de 10⁻⁸ grados, sin exigir Python ni conexión en las pruebas rutinarias. El contraste verifica la transformación matemática, no precisión absoluta del producto.

## Resultados locales reproducibles

Referencia histórica del motor en los tres cuerpos, no tres aterrizajes ofrecidos por la UI. Resultados con los archivos actuales, perfiles propuestos, `dt=0.25 s` y condiciones iniciales por defecto. Todos los contactos cumplieron las tolerancias, sin modificar el DEM ni sus datos científicos:

| Región | Candidato x,z m | Pendiente regional P90 ° | Estado regional | Tiempo s | Propelente restante kg |
| --- | --- | ---: | --- | ---: | ---: |
| La Corona | 712.5, 1012.5 | 1.53 | candidate | 31.60 | 499.47 |
| Marius Hills | −562.5, 562.5 | 0.90 | candidate | 37.64 | 156.91 |
| Wright Valley | 562.5, 112.5 | 6.45 | candidate | 31.60 | 499.46 |
| Shackleton | −37.5, −337.5 | 8.93 | caution | 41.12 | 155.01 |
| Atacama | −562.5, −562.5 | 0.78 | candidate | 31.60 | 499.48 |
| Jezero | 637.5, −262.5 | 1.02 | candidate | 36.02 | 209.23 |
| Wadi Rum | 1012.5, −1087.5 | 1.59 | candidate | 31.60 | 499.47 |
| Coprates / Valles Marineris | −937.5, −487.5 | 7.02 | candidate | 36.06 | 209.19 |

La selección puede encontrar una vecindad menos inclinada dentro de una ventana que contiene paredes abruptas. El resultado de Coprates no describe toda la pared como favorable. Shackleton conserva cautela regional e incertidumbre de resolución efectiva; el contacto interpolado no resuelve irregularidades de patas. El rover que salga de estos puntos necesitará considerar las pendientes de su ruta; la elegibilidad de una región de descenso no valida el trayecto científico.

Pruebas:

```sh
node --test tests/landing-profiles.test.mjs tests/landing-physics.test.mjs
```

Cubren tres cuerpos, contabilidad de masa, gravedad SI, consumo/impulso, empuje acotado, pausas, determinismo, convergencia al reducir subpaso, no mutación, aislamiento de datos, tolerancias de impacto sobre DEM inclinado, combustible cero/escaso, empuje insuficiente, aborto, límite de tiempo, nulos/rangos, bordes, falta de resolución, ausencia de candidatos, todas las regiones escarpadas, ruido milimétrico, ocho DEM reales e inversión de sus georreferencias. No se repite el backend ni se requiere WebGL.

## Fuentes y límites de inspiración

- [NASA Glenn · Specific Impulse](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/): relación entre empuje, flujo de masa e Isp. Consulta 2026-11-14; la fórmula no valida los parámetros propuestos.
- [NASA · SPLICE](https://www.nasa.gov/safe-and-precise-landing-integrated-capabilities-evolution-splice/): inspiración conceptual de navegación y detección de peligros. Atlas no implementa sus sensores, visión, lidar, fusión de estado ni algoritmos de TRN. Consulta 2026-11-14.
- [Vincenty (1975) · Direct and Inverse Solutions of Geodesics](https://geographiclib.sourceforge.io/geodesic-papers/vincenty75b.pdf) y [GeographicLib · problema directo](https://geographiclib.sourceforge.io/html/python/code.html): contexto matemático del método geodésico; comprobación independiente con PROJ.
- [Contrato de rejillas](contracts.md), [procedencia de objetivos](targets-sources.md), `scripts/fetch-targets.py` y `scripts/fetch-scenarios-earth.py`: orientación, proyección, resoluciones y procedencia local de los DEM. El motor conserva esas referencias; no modifica raster, backend ni recursos NASA.
