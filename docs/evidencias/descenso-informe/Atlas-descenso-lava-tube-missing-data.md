# Dossier local · Tubo de lava volcánico

Contrato 1.0.0 · Auditor 1.0.0 · 2026-11-14T20:00:32.000Z

Tubo volcánico de La Corona · Lanzarote ↔ Marius Hills · entorno del pozo (skylight) de tubo de lava

Auditoría exploratoria local; no certifica similitud física, seguridad ni aptitud de misión. Parámetros de calculadora son hipótesis del usuario.

## Strength vs. Breakdown

| Parámetro | Estado | Fortaleza | Ruptura | Acción |
| --- | --- | --- | --- | --- |
| Escala regional | valid | Misma ventana y muestreo: comparación regional reproducible. | La rejilla no resuelve contactos rueda/suelo, rocas ni cavidades; resolución nativa e interpolación limitan el ensayo. | Medir a la escala del instrumento antes de diseñar el ensayo. |
| Relieve · Strength vs. Breakdown | partial | Índice geométrico 72/100; pendientes, desnivel y TRI documentados. | El índice no mide similitud física; rugosidad radar dB y CPR no son intercambiables. | Usar componentes y advertencias para elegir tareas, sin umbral universal de validez. |
| Gravedad y carga estática | breakdown | Se puede ajustar la carga estática con un soporte vertical para una masa explícita. | La gravedad reducida no se reproduce en campo terrestre; descargar peso conserva la masa y su inercia. | Calcular F=m·g y descarga; validar dinámica y terramecánica por separado. |
| Atmósfera y vacío | breakdown | El terreno permite ensayar geometría y procedimientos al aire libre. | La atmósfera terrestre no reproduce el vacío lunar (exosfera). Cero Pa es una idealización de cálculo. | Ensayar en cámara con composición/presión controladas; ningún escalar convierte aire terrestre en el objetivo. |
| Presión local cuantitativa | unknown | Sin presión absoluta local terrestre: diferencia y cociente desconocidos. | No se transforma presión a nivel del mar en presión local ni se divide por cero lunar. | Conservar presión absoluta local y su fecha; sin dato no se calcula diferencia. No implica equivalencia aerodinámica. |
| Temperatura aire / superficie | unknown | Se conserva el producto térmico del objetivo y la procedencia del clima terrestre. | El aire terrestre no es temperatura superficial; no hay par superficial terrestre comparable ni serie sincronizada. | Medir superficie, aire y sumidero radiativo por separado; conservar nulos (incluido mínimo de Shackleton). |
| Convección y radiación térmica | breakdown | Q\_conv y Q\_rad se pueden explorar con parámetros explícitos del ensayo. | Vacío ideal: sin convección externa. Marte: coeficiente h desconocido. No hay factor térmico universal. | Cámara térmica y modelo con geometría/materiales, conducción y fuentes de calor propias. |
| Radiación ionizante | breakdown | Se pueden ensayar operaciones y geometría de blindajes. | Atmósfera y campo magnético terrestres alteran el entorno; irradiancia solar W/m² no es dosis ionizante. No hay dosimetría local. | Caracterizar espectro, dosis y blindaje con ensayos específicos; sin corrección escalar ni dosis inventada. |
| Regolito, polvo y subsuelo | unknown | El escenario aporta contexto regional para movilidad o perforación. | No hay granulometría, cohesión, humedad de contacto ni resistencia mecánica de muestras; un DEM no las determina. | Obtener muestras y ensayos mecánicos; no deducir hielo o blindaje a partir de relieve o CPR. |

## Cálculo de ensayo (SI; procedencia indicada en kind/origins)

```json
{
  "version": "1.0.0",
  "valid": true,
  "errors": [],
  "equipment": "rover",
  "targetBody": "moon",
  "inputs": {
    "massKg": 350,
    "earthGravityMs2": 9.81,
    "targetGravityMs2": 1.62,
    "earthPressurePa": null,
    "targetPressurePa": 0,
    "areaM2": null,
    "surfaceK": null,
    "airK": null,
    "surroundingsK": null,
    "hWm2K": null,
    "emissivity": null
  },
  "kind": "mission-config",
  "gravity": {
    "earthWeightN": 3433.5,
    "targetWeightN": 567,
    "targetToEarthRatio": 0.1651376146788991,
    "offloadForceN": 2866.5000000000005,
    "equivalentEarthMassKg": 57.79816513761468
  },
  "pressure": {
    "targetToEarthRatio": null,
    "earthToTargetRatio": null,
    "differencePa": null
  },
  "thermal": {
    "convectionW": null,
    "radiationW": null,
    "universalCorrectionFactor": null
  },
  "formulas": [
    "W = m·g",
    "r_g = g_obj/g_Tierra",
    "F_descarga = m·(g_Tierra − g_obj)",
    "m_equiv = m·r_g (solo carga estática)",
    "r_p = p_obj/p_Tierra (p_Tierra > 0)",
    "Q_conv = h·A·(T_superficie − T_aire)",
    "Q_rad = ε·σ·A·(T_superficie⁴ − T_entorno⁴)"
  ],
  "assumptions": [
    "Suelo horizontal, misma masa, soporte vertical cuasiestático; F_descarga positiva hacia arriba y negativa exige carga adicional.",
    "Q positiva = pérdida de calor. Superficie gris isotérmica en recinto negro grande, factor de vista 1; h explícito para el gas/ensayo, no derivado de presión.",
    "No es balance térmico completo: excluye conducción, Sol, albedo, disipación interna y transitorios. Vacío ideal externo: Q_conv = 0; Marte requiere h propio."
  ],
  "limitations": [
    "La masa (kg) no cambia con el cuerpo; el peso es una fuerza (N).",
    "La descarga vertical iguala solo la carga estática sobre suelo horizontal; no reproduce inercia, dinámica, cohesión, confinamiento del suelo, tracción ni terramecánica.",
    "En rueda, la masa es la soportada por esa rueda; no se supone reparto uniforme. En taladro, no se calcula fuerza de corte, par ni empuje activo.",
    "Vacío, convección, radiación ionizante, química y polvo no se compensan con un factor universal. Se requieren ensayos específicos.",
    "Temperatura del aire, temperatura superficial y sumidero radiativo son magnitudes distintas. Ninguna se sustituye automáticamente por otra.",
    "No se evalúan Froude, velocidad, tiempo, dosis ni autorización GO/NO-GO; tampoco se certifica un sitio o instrumento."
  ],
  "sources": {
    "gravity": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
    "moon": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
    "mars": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
    "weight": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/weight-equation-2/",
    "thermal": "https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/",
    "sigma": "https://physics.nist.gov/cgi-bin/cuu/Value?sigma",
    "radiation": "https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/"
  },
  "origins": {
    "massKg": {
      "value": 350,
      "unit": "kg",
      "kind": "mission-config",
      "source": "prototype-config",
      "observedAt": null
    },
    "earthGravityMs2": {
      "value": 9.81,
      "unit": "m/s²",
      "kind": "reference",
      "source": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
      "observedAt": null
    },
    "targetGravityMs2": {
      "value": 1.62,
      "unit": "m/s²",
      "kind": "reference",
      "source": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
      "observedAt": null
    },
    "earthPressurePa": {
      "value": null,
      "unit": "Pa",
      "kind": "unknown",
      "source": null,
      "observedAt": null
    },
    "targetPressurePa": {
      "value": 0,
      "unit": "Pa",
      "kind": "idealization",
      "source": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
      "observedAt": null
    },
    "airK": {
      "value": null,
      "unit": "K",
      "kind": "unknown",
      "source": null,
      "observedAt": null
    },
    "areaM2": {
      "value": null,
      "unit": "m²",
      "kind": "missing",
      "source": "Sin dato: no hay fuente/configuración de misión",
      "observedAt": null
    },
    "surfaceK": {
      "value": null,
      "unit": "K",
      "kind": "missing",
      "source": "Sin dato: no hay fuente/configuración de misión",
      "observedAt": null
    },
    "surroundingsK": {
      "value": null,
      "unit": "K",
      "kind": "missing",
      "source": "Sin dato: no hay fuente/configuración de misión",
      "observedAt": null
    },
    "hWm2K": {
      "value": null,
      "unit": "W/m²/K",
      "kind": "missing",
      "source": "Sin dato: no hay fuente/configuración de misión",
      "observedAt": null
    },
    "emissivity": {
      "value": null,
      "unit": "1",
      "kind": "missing",
      "source": "Sin dato: no hay fuente/configuración de misión",
      "observedAt": null
    }
  },
  "configuration": {
    "id": "atlas-prototype-v1",
    "source": "prototype-config",
    "massKg": 350,
    "equipment": "rover",
    "wheelSupportedMassKg": null,
    "drillMassKg": null,
    "assumption": "Prototipo didáctico de 350 kg; masa real de Perseverance/Scarecrow no inferida de sus mallas. Sin reparto de carga por rueda ni masa de taladro."
  }
}
```

## Evidencia y procedencia

- scale / earth.grid: {"gridSize":65,"spacingMeters":37.5,"extentMeters":2400,"nativeResolutionMeters":30,"dataset":"Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)","source":"https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30","fetchedAt":"2026-11-15T02:10:49+00:00","license":"https://spacedata.copernicus.eu/documents/20126/0/CSCDA\_ESA\_Mission-specific+Annex.pdf","credit":"© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"}
- scale / target.grid: {"gridSize":65,"spacingMeters":37.5,"extentMeters":2400,"nativeResolutionMeters":33.02,"dataset":"SELENE/Kaguya Terrain Camera DTM v2.0 (USGS Astrogeology, Ames Stereo Pipeline, alineado a LOLA)","source":"https://astrogeo-ard.s3-us-west-2.amazonaws.com/moon/kaguya/terrain\_camera/usgs\_dtms\_v2/TC1W2B0\_01\_02742N140E3036\_\_TC2W2B0\_01\_02742N145E3036/TC1W2B0\_01\_02742N140E3036\_\_TC2W2B0\_01\_02742N145E3036-DEM.tif","fetchedAt":"2026-11-14T17:15:29+00:00","license":null,"credit":null}
- geometry / geometry: {"index":72,"comparable":true,"components":\[{"key":"slopeP50Deg","label":"Pendiente mediana (p50)","unit":"°","earth":2.96,"target":1.73,"score":58.4,"weight":0.3333333333333333},{"key":"slopeP90Deg","label":"Pendiente p90","unit":"°","earth":5.4,"target":5.46,"score":98.9,"weight":0.2777777777777778},{"key":"reliefP95P5M","label":"Desnivel p95–p5","unit":"m","earth":101.68,"target":58.47,"score":57.5,"weight":0.22222222222222224},{"key":"triMeanM","label":"TRI medio","unit":"m","earth":1.7,"target":1.22,"score":71.8,"weight":0.16666666666666666}\],"caveats":\["Índice de similitud geométrica, no planetaria: la geometría del relieve no reproduce gravedad, regolito, iluminación ni química.","Rugosidad radar no disponible en ambos sitios: no entra en el índice.","Pesos editoriales del prototipo, no calibrados frente a misiones reales."\]}
- gravity / earth.gravity: {"value":9.81,"unit":"m/s²","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html","observedAt":null}
- gravity / target.gravity: {"value":1.62,"unit":"m/s²","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html","observedAt":null}
- atmosphere / target.pressure: {"value":0,"unit":"Pa","kind":"idealization","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html","observedAt":null}
- atmosphere / reference.atmosphere: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html"
- pressure / earth.pressure: {"value":null,"unit":"Pa","kind":"unknown","source":null,"observedAt":null}
- pressure / target.pressure: {"value":0,"unit":"Pa","kind":"idealization","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html","observedAt":null}
- temperature / earth.airTemperature: {"value":null,"unit":"K","kind":"unknown","source":null,"observedAt":null}
- temperature / earth.surfaceTemperature: {"minK":null,"maxK":null,"meanK":null,"kind":"unknown","source":null}
- temperature / target.surfaceTemperature: {"minK":96.7,"maxK":392,"meanK":214.2,"kind":"diviner","source":"LRO Diviner Global Cumulative Product LRO-L-DLRE-5-GCP-V1.0 (Williams et al. 2017, Icarus 283:300), Tbol media 2009-07→2015-04, celda 0.5° centrada en 14.25°N -56.75°E, 96 tramos de 0.25 h promediados a horas locales lunares. https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro\_diviner\_derived1/data\_derived\_gcp/global\_cumul\_avg\_cyl\_10n20n\_002.tab"}
- heat-transfer / reference.thermal: "https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/"
- radiation / earth.ionizingDoseRate: {"value":null,"unit":"Sv/s","kind":"unknown","source":null,"observedAt":null}
- radiation / target.ionizingDoseRate: {"value":null,"unit":"Sv/s","kind":"unknown","source":null,"observedAt":null}
- radiation / reference.radiation: "https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/"

### earth

Telemetría: desconocido
- Cabildo de Lanzarote · Cueva de los Verdes (tubo volcánico de La Corona): https://cactlanzarote.com/en/cact/cueva-de-los-verdes/
- Cueva de los Verdes · OpenStreetMap: https://www.openstreetmap.org/?mlat=29.1604&mlon=-13.4394\#map=15/29.1604/-13.4394
- Copernicus DEM GLO-30 · tesela Copernicus\_DSM\_COG\_10\_N29\_00\_W014\_00\_DEM (Planetary Computer): https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus\_DSM\_COG\_10\_N29\_00\_W014\_00\_DEM
- Sentinel-2 L2A · S2A\_MSIL2A\_20260930T114321\_R080\_T28RFT\_20260930T190708 (2026-09-30): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2A\_MSIL2A\_20260930T114321\_R080\_T28RFT\_20260930T190708
- Sentinel-1 RTC · S1C\_IW\_GRDH\_1SDV\_20261110T065315\_20261110T065340\_010271\_01482D\_rtc (2026-11-10): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C\_IW\_GRDH\_1SDV\_20261110T065315\_20261110T065340\_010271\_01482D\_rtc
- Centro de la ventana elegido con scripts/analog\_match.py: entre las ventanas de 2400 m a que contienen la entrada del punto de referencia (Cueva de los Verdes, 29.1604 N, 13.4394 O), la de mayor índice geométrico frente a «Marius Hills». Es una elección reproducible del equipo, no un punto de ensayo publicado.
- El tubo de lava de La Corona (~8 km, del volcán de La Corona al mar en Jameos del Agua) corre bajo el malpaís de la ventana; como en Marius Hills, el DEM muestra la superficie del flujo de lava, no el interior del tubo.
- Se descartan ventanas con mar (GLO-30 lo rellena con 0 m), por eso la ventana no llega a Jameos del Agua.
- Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain\_metrics.bilinear\_resample. Fila 0 = norte, columna 0 = oeste.
- Métricas calculadas con scripts/terrain\_metrics.compute\_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).
- thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).
- La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria.

### target

Telemetría: desconocido
- SELENE/Kaguya Terrain Camera DTM v2.0 (USGS Astrogeology, Ames Stereo Pipeline, alineado a LOLA): https://astrogeo-ard.s3-us-west-2.amazonaws.com/moon/kaguya/terrain\_camera/usgs\_dtms\_v2/TC1W2B0\_01\_02742N140E3036\_\_TC2W2B0\_01\_02742N145E3036/TC1W2B0\_01\_02742N140E3036\_\_TC2W2B0\_01\_02742N145E3036-DEM.tif
- Catálogo / página del producto: https://stac.astrogeology.usgs.gov/api/collections/kaguya\_terrain\_camera\_usgs\_dtms\_v2/items/TC1W2B0\_01\_02742N140E3036\_\_TC2W2B0\_01\_02742N145E3036
- Térmica: LRO Diviner Global Cumulative Product LRO-L-DLRE-5-GCP-V1.0: https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro\_diviner\_derived1/data\_derived\_gcp/global\_cumul\_avg\_cyl\_10n20n\_002.tab
- Imagen de contexto: https://astrogeo-ard.s3-us-west-2.amazonaws.com/moon/kaguya/terrain\_camera/usgs\_dtms\_v2/TC1W2B0\_01\_02742N140E3036\_\_TC2W2B0\_01\_02742N145E3036/TC1W2B0\_01\_02742N140E3036.ortho.tif
- Centro en el pozo de Marius Hills (14.091°N, 303.223°E = -56.777°), descubierto por Haruyama et al. (2009, GRL 36:L21206). El pozo (~65 m de diámetro, ~40 m de profundidad) es menor que la separación de 37.5 m y el DTM Kaguya (~33 m/px; se eligió el único par estéreo TC v2 que cubre la ventana completa sin huecos) no lo resuelve: la rejilla muestra la meseta de mare y los domos/canales del entorno.
- Diviner GCP es un promedio de 0.5° (~15 km): la curva térmica describe el mare circundante, no el interior del pozo (Horvath et al. 2022 miden ~290 K estables en sombras de pozos lunares, otro sitio).
- Rugosidad: se intenta Mini-RF CPR (mosaico global 128 ppd, ~237 m/px, rocas de escala decimétrica); sólo se publica si ≥ 80 % de los nodos tienen dato. No hay CPR terrestre en el contrato, así que nunca entra en la comparación geométrica.
- Mini-RF CPR: sólo 45% de nodos con dato válido en el mosaico global; roughness = null.

## Supuestos y límites

- La masa (kg) no cambia con el cuerpo; el peso es una fuerza (N).
- La descarga vertical iguala solo la carga estática sobre suelo horizontal; no reproduce inercia, dinámica, cohesión, confinamiento del suelo, tracción ni terramecánica.
- En rueda, la masa es la soportada por esa rueda; no se supone reparto uniforme. En taladro, no se calcula fuerza de corte, par ni empuje activo.
- Vacío, convección, radiación ionizante, química y polvo no se compensan con un factor universal. Se requieren ensayos específicos.
- Temperatura del aire, temperatura superficial y sumidero radiativo son magnitudes distintas. Ninguna se sustituye automáticamente por otra.
- No se evalúan Froude, velocidad, tiempo, dosis ni autorización GO/NO-GO; tampoco se certifica un sitio o instrumento.

## Referencias

- gravity: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
- moon: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- mars: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- weight: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/weight-equation-2/
- thermal: https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/
- sigma: https://physics.nist.gov/cgi-bin/cuu/Value?sigma
- radiation: https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/


## Descenso final (simulación)

Misión: evidence-lava-tube-missing-data. Escenario: lava-tube. Fase: unavailable.
Inicio UTC: 2026-11-14T20:00:00.000Z. Fin UTC: 2026-11-14T20:00:32.000Z.
Descenso propulsado final idealizado; Tierra es comparación virtual. DEM regional: no resuelve patas, rocas ni cavidades. Contacto del modelo no certifica seguridad; sin TRN/visión NASA implementada, entrada ni paracaídas. UTC, SIM descenso (s) y SIM rover ×20 son relojes separados; exageración visual ×2 no cambia física SI.

### Tierra virtual
Perfil de nave separado del rover de 350 kg: atlas-final-earth-v1.
```json
{
  "profile": {
    "schema": "LandingProfile",
    "version": "1.0.0",
    "kind": "proposed-design",
    "payloadKg": 350,
    "landerDryMassKg": 500,
    "dryMassKg": 850,
    "ispSeconds": 305,
    "g0Ms2": 9.80665,
    "tiltMaxDeg": 15,
    "startAltitudeM": 180,
    "startVerticalSpeedMs": -6,
    "startOffsetXM": 60,
    "startOffsetZM": -45,
    "maxDescentSpeedMs": 12,
    "finalDescentSpeedMs": 0.6,
    "maxAccelerationMs2": 3,
    "brakingAccelerationMs2": 1.5,
    "lateralAccelerationMs2": 2,
    "touchdownVerticalSpeedMs": 1.2,
    "touchdownHorizontalSpeedMs": 0.8,
    "touchdownTiltDeg": 8,
    "touchdownPositionErrorM": 12,
    "maxRegionalSlopeDeg": 12,
    "maxRegionalReliefM": 70,
    "regionalRadiusCells": 3,
    "nominalScienceSeparationM": 300,
    "maxNativeResolutionRatio": 2,
    "maxSimSeconds": 180,
    "assumptions": {
      "propulsion": "Empuje modulable ideal 0..máximo; Isp constante, sin corrección de tobera por ambiente.",
      "navigation": "Estado y DEM conocidos exactamente; control idealizado, sin sensores ni TRN implementados.",
      "atmosphere": "Sin arrastre, viento, sustentación ni presión en el modelo de movimiento.",
      "attitude": "Vector de empuje acotado; actitud instantánea, sin dinámica rotacional ni patas.",
      "payload": "350 kg de carga rover desde ROVER_CONFIG más 500 kg de nave seca propuestos; no es la masa total de la nave."
    },
    "sources": [
      {
        "label": "NASA Glenn · Specific Impulse",
        "url": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/",
        "role": "Isp = T/(flujo de masa · g0); no valida este diseño.",
        "accessedOn": "2026-11-14"
      },
      {
        "label": "NASA · SPLICE",
        "url": "https://www.nasa.gov/safe-and-precise-landing-integrated-capabilities-evolution-splice/",
        "role": "Inspiración conceptual de navegación; sensores/algoritmos no implementados.",
        "accessedOn": "2026-11-14"
      }
    ],
    "limitations": [
      "Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.",
      "Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.",
      "El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.",
      "Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.",
      "La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.",
      "Tierra es una comparación virtual sin aerodinámica, no un ensayo físico terrestre."
    ],
    "propellantKg": 650,
    "thrustMaxN": 22000,
    "label": "Tierra · comparación virtual",
    "id": "atlas-final-earth-v1",
    "body": "earth",
    "gravityMs2": 9.81
  },
  "plan": {
    "schema": "LandingZonePlan",
    "version": "1.0.0",
    "gridId": "la-corona",
    "body": "earth",
    "profileId": "atlas-final-earth-v1",
    "grid": {
      "id": "la-corona",
      "body": "earth",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 30,
      "center": [
        29.16953,
        -13.44056
      ],
      "dataset": "Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)",
      "source": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30",
      "fetchedAt": "2026-11-15T02:10:49+00:00",
      "sampling": null,
      "georeferencing": {
        "frame": "AEQD",
        "ellipsoid": "WGS84",
        "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
      },
      "notes": [
        "Centro de la ventana elegido con scripts/analog_match.py: entre las ventanas de 2400 m a que contienen la entrada del punto de referencia (Cueva de los Verdes, 29.1604 N, 13.4394 O), la de mayor índice geométrico frente a «Marius Hills». Es una elección reproducible del equipo, no un punto de ensayo publicado.",
        "El tubo de lava de La Corona (~8 km, del volcán de La Corona al mar en Jameos del Agua) corre bajo el malpaís de la ventana; como en Marius Hills, el DEM muestra la superficie del flujo de lava, no el interior del tubo.",
        "Se descartan ventanas con mar (GLO-30 lo rellena con 0 m), por eso la ventana no llega a Jameos del Agua.",
        "Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.",
        "Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).",
        "thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).",
        "La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria."
      ],
      "provenance": [
        {
          "label": "Cabildo de Lanzarote · Cueva de los Verdes (tubo volcánico de La Corona)",
          "url": "https://cactlanzarote.com/en/cact/cueva-de-los-verdes/"
        },
        {
          "label": "Cueva de los Verdes · OpenStreetMap",
          "url": "https://www.openstreetmap.org/?mlat=29.1604&mlon=-13.4394#map=15/29.1604/-13.4394"
        },
        {
          "label": "Copernicus DEM GLO-30 · tesela Copernicus_DSM_COG_10_N29_00_W014_00_DEM (Planetary Computer)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus_DSM_COG_10_N29_00_W014_00_DEM"
        },
        {
          "label": "Sentinel-2 L2A · S2A_MSIL2A_20260930T114321_R080_T28RFT_20260930T190708 (2026-09-30)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2A_MSIL2A_20260930T114321_R080_T28RFT_20260930T190708"
        },
        {
          "label": "Sentinel-1 RTC · S1C_IW_GRDH_1SDV_20261110T065315_20261110T065340_010271_01482D_rtc (2026-11-10)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C_IW_GRDH_1SDV_20261110T065315_20261110T065340_010271_01482D_rtc"
        }
      ]
    },
    "sciencePoint": {
      "x": 0,
      "z": 0
    },
    "zones": [
      {
        "id": "la-corona-r59-c51",
        "gridId": "la-corona",
        "x": 712.5,
        "z": 1012.5,
        "elevationM": 19.4,
        "slopeDeg": 1.5275254422129259,
        "maxSlopeDeg": 2.4431381125028384,
        "reliefM": 5.800000000000001,
        "scienceDistanceM": 1238.0680514414385,
        "status": "candidate",
        "eligible": true,
        "score": 85,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 30,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 29.16039488655605,
          "longitude": -13.43323639123355,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD WGS84 mediante geodésica directa Vincenty.",
          "reference": {
            "frame": "AEQD",
            "ellipsoid": "WGS84",
            "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "la-corona-r47-c61",
        "gridId": "la-corona",
        "x": 1087.5,
        "z": 562.5,
        "elevationM": 11.5,
        "slopeDeg": 2.666414118561149,
        "maxSlopeDeg": 3.3505756636637476,
        "reliefM": 4.299999999999999,
        "scienceDistanceM": 1224.362078798588,
        "status": "candidate",
        "eligible": true,
        "score": 80.5,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 30,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 29.164454583269986,
          "longitude": -13.429381420544814,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD WGS84 mediante geodésica directa Vincenty.",
          "reference": {
            "frame": "AEQD",
            "ellipsoid": "WGS84",
            "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "la-corona-r21-c51",
        "gridId": "la-corona",
        "x": 712.5,
        "z": -412.5,
        "elevationM": 35.6,
        "slopeDeg": 2.518233770925784,
        "maxSlopeDeg": 2.81501802585479,
        "reliefM": 10.2,
        "scienceDistanceM": 823.2936900037556,
        "status": "candidate",
        "eligible": true,
        "score": 80.1,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 30,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 29.173251427467957,
          "longitude": -13.43323547865839,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD WGS84 mediante geodésica directa Vincenty.",
          "reference": {
            "frame": "AEQD",
            "ellipsoid": "WGS84",
            "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "la-corona-r45-c23",
        "gridId": "la-corona",
        "x": -337.5,
        "z": 487.5,
        "elevationM": 74.2,
        "slopeDeg": 2.8964926285791064,
        "maxSlopeDeg": 4.029972369796315,
        "reliefM": 9.899999999999991,
        "scienceDistanceM": 592.9270612815711,
        "status": "candidate",
        "eligible": true,
        "score": 79.2,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 30,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 29.16513166507493,
          "longitude": -13.444029237072414,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD WGS84 mediante geodésica directa Vincenty.",
          "reference": {
            "frame": "AEQD",
            "ellipsoid": "WGS84",
            "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "la-corona-r27-c39",
        "gridId": "la-corona",
        "x": 262.5,
        "z": -187.5,
        "elevationM": 57.2,
        "slopeDeg": 3.4429212687038917,
        "maxSlopeDeg": 6.4690370868628335,
        "reliefM": 9.100000000000001,
        "scienceDistanceM": 322.5871975140985,
        "status": "candidate",
        "eligible": true,
        "score": 78.6,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 30,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 29.17122162204639,
          "longitude": -13.437861545231954,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD WGS84 mediante geodésica directa Vincenty.",
          "reference": {
            "frame": "AEQD",
            "ellipsoid": "WGS84",
            "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      }
    ],
    "selectedId": "la-corona-r59-c51",
    "scoring": "Score heurístico 0..100 = 100·clamp(1−0.55·pendienteP90/límite−0.35·desnivel/límite−0.10·distancia/extensión,0,1); costes redondeados 0.1°/1m, no probabilidad.",
    "limitations": [
      "Heurística regional determinista, sin probabilidad de éxito ni zona segura certificada.",
      "Navegación idealizada con posición exacta; no implementa visión, TRN, SPLICE ni detección de obstáculos.",
      "Coordenadas locales x este, z sur, y altura DEM, en metros SI; exageración gráfica ×2 excluida de la física.",
      "Punto científico y contacto son distintos; la separación nominal no representa el contorno de un pozo.",
      "Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.",
      "Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.",
      "El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.",
      "Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.",
      "La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.",
      "Tierra es una comparación virtual sin aerodinámica, no un ensayo físico terrestre."
    ],
    "errors": []
  },
  "run": {
    "schema": "LandingRunSummary",
    "version": "1.0.0",
    "body": "earth",
    "profileId": "atlas-final-earth-v1",
    "phase": "contact",
    "guidanceStage": "terminal",
    "simSeconds": 31.596938976645784,
    "x": 712.8761973045436,
    "z": 1012.2398485360437,
    "yM": 19.395752599264057,
    "altitudeM": 0,
    "groundElevationM": 19.395752599264057,
    "verticalSpeedMs": -0.8453641877927774,
    "horizontalSpeedMs": 0.08203146901060775,
    "vxMs": -0.06747019978744953,
    "vyMs": -0.8453641877927774,
    "vzMs": 0.0466576258362976,
    "pitchDeg": -0.04713166491979761,
    "rollDeg": -0.06815564968599291,
    "thrustN": 0,
    "throttle": 0,
    "propellantKg": 499.4728722777084,
    "massKg": 1349.4728722777083,
    "gravityMs2": 9.81,
    "weightN": 13238.32887704432,
    "positionErrorM": 0.4573873589687719,
    "target": {
      "id": "la-corona-r59-c51",
      "gridId": "la-corona",
      "x": 712.5,
      "z": 1012.5,
      "elevationM": 19.4,
      "slopeDeg": 1.5275254422129259,
      "maxSlopeDeg": 2.4431381125028384,
      "reliefM": 5.800000000000001,
      "scienceDistanceM": 1238.0680514414385,
      "status": "candidate",
      "eligible": true,
      "score": 85,
      "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
      "scaleMeters": 225,
      "neighborhoodRadiusM": 112.5,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 30,
      "coverage": 1,
      "sciencePoint": {
        "x": 0,
        "z": 0
      },
      "georeference": {
        "latitude": 29.16039488655605,
        "longitude": -13.43323639123355,
        "kind": "model-projection-inverse",
        "method": "Inversa AEQD WGS84 mediante geodésica directa Vincenty.",
        "reference": {
          "frame": "AEQD",
          "ellipsoid": "WGS84",
          "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
        },
        "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
      }
    },
    "contact": {
      "verticalSpeedMs": 0.8461259501798893,
      "horizontalSpeedMs": 0.08203146901060775,
      "tiltDeg": 0.0828648431555078,
      "positionErrorM": 0.4573873589687719,
      "slopeDeg": 1.2316325069439764,
      "withinTolerances": true,
      "checks": {
        "verticalSpeed": true,
        "horizontalSpeed": true,
        "tilt": true,
        "position": true,
        "slope": true,
        "propulsion": true
      }
    },
    "profile": {
      "schema": "LandingProfile",
      "version": "1.0.0",
      "kind": "proposed-design",
      "payloadKg": 350,
      "landerDryMassKg": 500,
      "dryMassKg": 850,
      "ispSeconds": 305,
      "g0Ms2": 9.80665,
      "tiltMaxDeg": 15,
      "startAltitudeM": 180,
      "startVerticalSpeedMs": -6,
      "startOffsetXM": 60,
      "startOffsetZM": -45,
      "maxDescentSpeedMs": 12,
      "finalDescentSpeedMs": 0.6,
      "maxAccelerationMs2": 3,
      "brakingAccelerationMs2": 1.5,
      "lateralAccelerationMs2": 2,
      "touchdownVerticalSpeedMs": 1.2,
      "touchdownHorizontalSpeedMs": 0.8,
      "touchdownTiltDeg": 8,
      "touchdownPositionErrorM": 12,
      "maxRegionalSlopeDeg": 12,
      "maxRegionalReliefM": 70,
      "regionalRadiusCells": 3,
      "nominalScienceSeparationM": 300,
      "maxNativeResolutionRatio": 2,
      "maxSimSeconds": 180,
      "assumptions": {
        "propulsion": "Empuje modulable ideal 0..máximo; Isp constante, sin corrección de tobera por ambiente.",
        "navigation": "Estado y DEM conocidos exactamente; control idealizado, sin sensores ni TRN implementados.",
        "atmosphere": "Sin arrastre, viento, sustentación ni presión en el modelo de movimiento.",
        "attitude": "Vector de empuje acotado; actitud instantánea, sin dinámica rotacional ni patas.",
        "payload": "350 kg de carga rover desde ROVER_CONFIG más 500 kg de nave seca propuestos; no es la masa total de la nave."
      },
      "sources": [
        {
          "label": "NASA Glenn · Specific Impulse",
          "url": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/",
          "role": "Isp = T/(flujo de masa · g0); no valida este diseño.",
          "accessedOn": "2026-11-14"
        },
        {
          "label": "NASA · SPLICE",
          "url": "https://www.nasa.gov/safe-and-precise-landing-integrated-capabilities-evolution-splice/",
          "role": "Inspiración conceptual de navegación; sensores/algoritmos no implementados.",
          "accessedOn": "2026-11-14"
        }
      ],
      "limitations": [
        "Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.",
        "Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.",
        "El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.",
        "Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.",
        "La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.",
        "Tierra es una comparación virtual sin aerodinámica, no un ensayo físico terrestre."
      ],
      "propellantKg": 650,
      "thrustMaxN": 22000,
      "label": "Tierra · comparación virtual",
      "id": "atlas-final-earth-v1",
      "body": "earth",
      "gravityMs2": 9.81
    },
    "grid": {
      "id": "la-corona",
      "body": "earth",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 30,
      "center": [
        29.16953,
        -13.44056
      ],
      "dataset": "Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)",
      "source": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30",
      "fetchedAt": "2026-11-15T02:10:49+00:00",
      "sampling": null,
      "georeferencing": {
        "frame": "AEQD",
        "ellipsoid": "WGS84",
        "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
      },
      "notes": [
        "Centro de la ventana elegido con scripts/analog_match.py: entre las ventanas de 2400 m a que contienen la entrada del punto de referencia (Cueva de los Verdes, 29.1604 N, 13.4394 O), la de mayor índice geométrico frente a «Marius Hills». Es una elección reproducible del equipo, no un punto de ensayo publicado.",
        "El tubo de lava de La Corona (~8 km, del volcán de La Corona al mar en Jameos del Agua) corre bajo el malpaís de la ventana; como en Marius Hills, el DEM muestra la superficie del flujo de lava, no el interior del tubo.",
        "Se descartan ventanas con mar (GLO-30 lo rellena con 0 m), por eso la ventana no llega a Jameos del Agua.",
        "Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.",
        "Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).",
        "thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).",
        "La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria."
      ],
      "provenance": [
        {
          "label": "Cabildo de Lanzarote · Cueva de los Verdes (tubo volcánico de La Corona)",
          "url": "https://cactlanzarote.com/en/cact/cueva-de-los-verdes/"
        },
        {
          "label": "Cueva de los Verdes · OpenStreetMap",
          "url": "https://www.openstreetmap.org/?mlat=29.1604&mlon=-13.4394#map=15/29.1604/-13.4394"
        },
        {
          "label": "Copernicus DEM GLO-30 · tesela Copernicus_DSM_COG_10_N29_00_W014_00_DEM (Planetary Computer)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus_DSM_COG_10_N29_00_W014_00_DEM"
        },
        {
          "label": "Sentinel-2 L2A · S2A_MSIL2A_20260930T114321_R080_T28RFT_20260930T190708 (2026-09-30)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2A_MSIL2A_20260930T114321_R080_T28RFT_20260930T190708"
        },
        {
          "label": "Sentinel-1 RTC · S1C_IW_GRDH_1SDV_20261110T065315_20261110T065340_010271_01482D_rtc (2026-11-10)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C_IW_GRDH_1SDV_20261110T065315_20261110T065340_010271_01482D_rtc"
        }
      ]
    },
    "georeference": {
      "latitude": 29.160397233468167,
      "longitude": -13.433232524229197,
      "kind": "model-projection-inverse",
      "method": "Inversa AEQD WGS84 mediante geodésica directa Vincenty.",
      "reference": {
        "frame": "AEQD",
        "ellipsoid": "WGS84",
        "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
      },
      "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
    },
    "outcome": {
      "code": "within-model-tolerances",
      "label": "Contacto dentro de tolerancias del modelo; terreno no certificado.",
      "success": true
    },
    "faultCodes": [],
    "limits": {
      "verticalSpeedMs": 1.2,
      "horizontalSpeedMs": 0.8,
      "tiltDeg": 8,
      "positionErrorM": 12,
      "regionalSlopeDeg": 12,
      "regionalReliefM": 70,
      "maxSimSeconds": 180,
      "maxSubstepSeconds": 0.05
    },
    "limitations": [
      "Heurística regional determinista, sin probabilidad de éxito ni zona segura certificada.",
      "Navegación idealizada con posición exacta; no implementa visión, TRN, SPLICE ni detección de obstáculos.",
      "Coordenadas locales x este, z sur, y altura DEM, en metros SI; exageración gráfica ×2 excluida de la física.",
      "Punto científico y contacto son distintos; la separación nominal no representa el contorno de un pozo.",
      "Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.",
      "Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.",
      "El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.",
      "Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.",
      "La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.",
      "Tierra es una comparación virtual sin aerodinámica, no un ensayo físico terrestre."
    ]
  }
}
```
### Objetivo
Perfil de nave separado del rover de 350 kg: atlas-final-moon-v1.
```json
{
  "profile": {
    "schema": "LandingProfile",
    "version": "1.0.0",
    "kind": "proposed-design",
    "payloadKg": 350,
    "landerDryMassKg": 500,
    "dryMassKg": 850,
    "ispSeconds": 305,
    "g0Ms2": 9.80665,
    "tiltMaxDeg": 15,
    "startAltitudeM": 180,
    "startVerticalSpeedMs": -6,
    "startOffsetXM": 60,
    "startOffsetZM": -45,
    "maxDescentSpeedMs": 12,
    "finalDescentSpeedMs": 0.6,
    "maxAccelerationMs2": 3,
    "brakingAccelerationMs2": 1.5,
    "lateralAccelerationMs2": 2,
    "touchdownVerticalSpeedMs": 1.2,
    "touchdownHorizontalSpeedMs": 0.8,
    "touchdownTiltDeg": 8,
    "touchdownPositionErrorM": 12,
    "maxRegionalSlopeDeg": 12,
    "maxRegionalReliefM": 70,
    "regionalRadiusCells": 3,
    "nominalScienceSeparationM": 300,
    "maxNativeResolutionRatio": 2,
    "maxSimSeconds": 180,
    "assumptions": {
      "propulsion": "Empuje modulable ideal 0..máximo; Isp constante, sin corrección de tobera por ambiente.",
      "navigation": "Estado y DEM conocidos exactamente; control idealizado, sin sensores ni TRN implementados.",
      "atmosphere": "Sin arrastre, viento, sustentación ni presión en el modelo de movimiento.",
      "attitude": "Vector de empuje acotado; actitud instantánea, sin dinámica rotacional ni patas.",
      "payload": "350 kg de carga rover desde ROVER_CONFIG más 500 kg de nave seca propuestos; no es la masa total de la nave."
    },
    "sources": [
      {
        "label": "NASA Glenn · Specific Impulse",
        "url": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/",
        "role": "Isp = T/(flujo de masa · g0); no valida este diseño.",
        "accessedOn": "2026-11-14"
      },
      {
        "label": "NASA · SPLICE",
        "url": "https://www.nasa.gov/safe-and-precise-landing-integrated-capabilities-evolution-splice/",
        "role": "Inspiración conceptual de navegación; sensores/algoritmos no implementados.",
        "accessedOn": "2026-11-14"
      }
    ],
    "limitations": [
      "Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.",
      "Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.",
      "El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.",
      "Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.",
      "La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.",
      "Vacío lunar ideal: no se modelan interacción de pluma, regolito ni sombras como navegación."
    ],
    "propellantKg": 180,
    "thrustMaxN": 6000,
    "label": "Luna · descenso final idealizado",
    "id": "atlas-final-moon-v1",
    "body": "moon",
    "gravityMs2": 1.62
  },
  "plan": {
    "schema": "LandingZonePlan",
    "version": "1.0.0",
    "gridId": null,
    "body": null,
    "profileId": "atlas-final-moon-v1",
    "grid": null,
    "sciencePoint": {
      "x": 0,
      "z": 0
    },
    "zones": [],
    "selectedId": null,
    "scoring": "Score heurístico 0..100 = 100·clamp(1−0.55·pendienteP90/límite−0.35·desnivel/límite−0.10·distancia/extensión,0,1); costes redondeados 0.1°/1m, no probabilidad.",
    "limitations": [
      "Heurística regional determinista, sin probabilidad de éxito ni zona segura certificada.",
      "Navegación idealizada con posición exacta; no implementa visión, TRN, SPLICE ni detección de obstáculos.",
      "Coordenadas locales x este, z sur, y altura DEM, en metros SI; exageración gráfica ×2 excluida de la física.",
      "Punto científico y contacto son distintos; la separación nominal no representa el contorno de un pozo.",
      "Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.",
      "Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.",
      "El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.",
      "Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.",
      "La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.",
      "Vacío lunar ideal: no se modelan interacción de pluma, regolito ni sombras como navegación.",
      "grid: DEM requerido"
    ],
    "errors": [
      "grid: DEM requerido"
    ]
  },
  "run": {
    "schema": "LandingRunSummary",
    "version": "1.0.0",
    "body": "moon",
    "profileId": "atlas-final-moon-v1",
    "phase": "unavailable",
    "guidanceStage": null,
    "simSeconds": 0,
    "x": null,
    "z": null,
    "yM": null,
    "altitudeM": null,
    "groundElevationM": null,
    "verticalSpeedMs": null,
    "horizontalSpeedMs": null,
    "vxMs": null,
    "vyMs": null,
    "vzMs": null,
    "pitchDeg": null,
    "rollDeg": null,
    "thrustN": null,
    "throttle": null,
    "propellantKg": null,
    "massKg": null,
    "gravityMs2": 1.62,
    "weightN": null,
    "positionErrorM": null,
    "target": null,
    "contact": null,
    "profile": {
      "schema": "LandingProfile",
      "version": "1.0.0",
      "kind": "proposed-design",
      "payloadKg": 350,
      "landerDryMassKg": 500,
      "dryMassKg": 850,
      "ispSeconds": 305,
      "g0Ms2": 9.80665,
      "tiltMaxDeg": 15,
      "startAltitudeM": 180,
      "startVerticalSpeedMs": -6,
      "startOffsetXM": 60,
      "startOffsetZM": -45,
      "maxDescentSpeedMs": 12,
      "finalDescentSpeedMs": 0.6,
      "maxAccelerationMs2": 3,
      "brakingAccelerationMs2": 1.5,
      "lateralAccelerationMs2": 2,
      "touchdownVerticalSpeedMs": 1.2,
      "touchdownHorizontalSpeedMs": 0.8,
      "touchdownTiltDeg": 8,
      "touchdownPositionErrorM": 12,
      "maxRegionalSlopeDeg": 12,
      "maxRegionalReliefM": 70,
      "regionalRadiusCells": 3,
      "nominalScienceSeparationM": 300,
      "maxNativeResolutionRatio": 2,
      "maxSimSeconds": 180,
      "assumptions": {
        "propulsion": "Empuje modulable ideal 0..máximo; Isp constante, sin corrección de tobera por ambiente.",
        "navigation": "Estado y DEM conocidos exactamente; control idealizado, sin sensores ni TRN implementados.",
        "atmosphere": "Sin arrastre, viento, sustentación ni presión en el modelo de movimiento.",
        "attitude": "Vector de empuje acotado; actitud instantánea, sin dinámica rotacional ni patas.",
        "payload": "350 kg de carga rover desde ROVER_CONFIG más 500 kg de nave seca propuestos; no es la masa total de la nave."
      },
      "sources": [
        {
          "label": "NASA Glenn · Specific Impulse",
          "url": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/",
          "role": "Isp = T/(flujo de masa · g0); no valida este diseño.",
          "accessedOn": "2026-11-14"
        },
        {
          "label": "NASA · SPLICE",
          "url": "https://www.nasa.gov/safe-and-precise-landing-integrated-capabilities-evolution-splice/",
          "role": "Inspiración conceptual de navegación; sensores/algoritmos no implementados.",
          "accessedOn": "2026-11-14"
        }
      ],
      "limitations": [
        "Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.",
        "Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.",
        "El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.",
        "Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.",
        "La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.",
        "Vacío lunar ideal: no se modelan interacción de pluma, regolito ni sombras como navegación."
      ],
      "propellantKg": 180,
      "thrustMaxN": 6000,
      "label": "Luna · descenso final idealizado",
      "id": "atlas-final-moon-v1",
      "body": "moon",
      "gravityMs2": 1.62
    },
    "grid": null,
    "georeference": null,
    "outcome": {
      "code": "unavailable",
      "label": "grid: DEM requerido; grid/profile: cuerpos incompatibles; zone: candidato con id/x/z requerido",
      "success": false
    },
    "faultCodes": [],
    "limits": null,
    "limitations": [
      "Heurística regional determinista, sin probabilidad de éxito ni zona segura certificada.",
      "Navegación idealizada con posición exacta; no implementa visión, TRN, SPLICE ni detección de obstáculos.",
      "Coordenadas locales x este, z sur, y altura DEM, en metros SI; exageración gráfica ×2 excluida de la física.",
      "Punto científico y contacto son distintos; la separación nominal no representa el contorno de un pozo.",
      "grid: DEM requerido; grid/profile: cuerpos incompatibles; zone: candidato con id/x/z requerido"
    ]
  }
}
```
Historial: 65 muestras; eventos: 3. UTC y SIM descenso independientes del rover ×20.
- Ejecución reproducible del motor idealizado a 2 muestras/s SIM; fechas de evidencia controladas, no observación UTC de vuelo.
- Datos DEM reales versionados; la ejecución es virtual. No certifica el terreno.
- SIM descenso y UTC controlada separados del SIM rover ×20; no se fabrican muestras rover.
