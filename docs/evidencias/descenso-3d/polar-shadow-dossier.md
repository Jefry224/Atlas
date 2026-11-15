# Dossier local · Cráter polar en sombra

Contrato 1.0.0 · Auditor 1.0.0 · 2026-11-15T03:56:50.380Z

Wright Valley · Valles secos de McMurdo ↔ Cráter Shackleton · borde (Polo Sur lunar, sitio Artemis «Shackleton rim»)

Auditoría automática de misión; referencias/modelos/configuración con ausencias explícitas. Sin GO/NO-GO.

## Strength vs. Breakdown

| Parámetro | Estado | Fortaleza | Ruptura | Acción |
| --- | --- | --- | --- | --- |
| Escala regional | valid | Misma ventana y muestreo: comparación regional reproducible. | La rejilla no resuelve contactos rueda/suelo, rocas ni cavidades; resolución nativa e interpolación limitan el ensayo. | Medir a la escala del instrumento antes de diseñar el ensayo. |
| Relieve · Strength vs. Breakdown | partial | Índice geométrico 97/100; pendientes, desnivel y TRI documentados. | El índice no mide similitud física; rugosidad radar dB y CPR no son intercambiables. | Usar componentes y advertencias para elegir tareas, sin umbral universal de validez. |
| Gravedad y carga estática | breakdown | Se puede ajustar la carga estática con un soporte vertical para una masa explícita. | La gravedad reducida no se reproduce en campo terrestre; descargar peso conserva la masa y su inercia. | Calcular F=m·g y descarga; validar dinámica y terramecánica por separado. |
| Atmósfera y vacío | breakdown | El terreno permite ensayar geometría y procedimientos al aire libre. | La atmósfera terrestre no reproduce el vacío lunar (exosfera). Cero Pa es una idealización de cálculo. | Ensayar en cámara con composición/presión controladas; ningún escalar convierte aire terrestre en el objetivo. |
| Presión local cuantitativa | partial | Presiones explícitas permiten calcular diferencia y cocientes con denominador positivo. | No se transforma presión a nivel del mar en presión local ni se divide por cero lunar. | Conservar presión absoluta local y su fecha; sin dato no se calcula diferencia. No implica equivalencia aerodinámica. |
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
    "earthPressurePa": 85915,
    "targetPressurePa": 0,
    "areaM2": null,
    "surfaceK": null,
    "airK": 256.15,
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
    "targetToEarthRatio": 0,
    "earthToTargetRatio": null,
    "differencePa": 85915
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
      "value": 85915,
      "unit": "Pa",
      "kind": "weather-model",
      "source": "https://www.meteomatics.com/en/api/getting-started/",
      "observedAt": "2026-11-15T03:50:24Z"
    },
    "targetPressurePa": {
      "value": 0,
      "unit": "Pa",
      "kind": "idealization",
      "source": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
      "observedAt": null
    },
    "airK": {
      "value": 256.15,
      "unit": "K",
      "kind": "weather-model",
      "source": "https://www.meteomatics.com/en/api/getting-started/",
      "observedAt": "2026-11-15T03:50:24Z"
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

- scale / earth.grid: {"gridSize":65,"spacingMeters":37.5,"extentMeters":2400,"nativeResolutionMeters":30,"dataset":"Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)","source":"https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30","fetchedAt":"2026-11-15T02:07:21+00:00","license":"https://spacedata.copernicus.eu/documents/20126/0/CSCDA\_ESA\_Mission-specific+Annex.pdf","credit":"© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"}
- scale / target.grid: {"gridSize":65,"spacingMeters":37.5,"extentMeters":2400,"nativeResolutionMeters":5,"dataset":"LRO LOLA 5 m/pix LDEM, Site04 «Shackleton rim» (Barker et al. 2021, NASA GSFC PGDA)","source":"https://pgda.gsfc.nasa.gov/data/LOLA\_5mpp/Site04/Site04\_final\_adj\_5mpp\_surf.tif","fetchedAt":"2026-11-14T17:17:12+00:00","license":null,"credit":null}
- geometry / geometry: {"index":97,"comparable":true,"components":\[{"key":"slopeP50Deg","label":"Pendiente mediana (p50)","unit":"°","earth":16.64,"target":16.97,"score":98.1,"weight":0.3333333333333333},{"key":"slopeP90Deg","label":"Pendiente p90","unit":"°","earth":31.81,"target":31.6,"score":99.3,"weight":0.2777777777777778},{"key":"reliefP95P5M","label":"Desnivel p95–p5","unit":"m","earth":575.76,"target":541.82,"score":94.1,"weight":0.22222222222222224},{"key":"triMeanM","label":"TRI medio","unit":"m","earth":10.27,"target":10.5,"score":97.8,"weight":0.16666666666666666}\],"caveats":\["Índice de similitud geométrica, no planetaria: la geometría del relieve no reproduce gravedad, regolito, iluminación ni química.","Rugosidad excluida: unidades distintas (dB vs CPR); radar terrestre y Mini-RF no son directamente comparables.","Pesos editoriales del prototipo, no calibrados frente a misiones reales."\]}
- gravity / earth.gravity: {"value":9.81,"unit":"m/s²","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html","observedAt":null}
- gravity / target.gravity: {"value":1.62,"unit":"m/s²","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html","observedAt":null}
- atmosphere / target.pressure: {"value":0,"unit":"Pa","kind":"idealization","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html","observedAt":null}
- atmosphere / reference.atmosphere: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html"
- pressure / earth.pressure: {"value":85915,"unit":"Pa","kind":"weather-model","source":"https://www.meteomatics.com/en/api/getting-started/","observedAt":"2026-11-15T03:50:24Z"}
- pressure / target.pressure: {"value":0,"unit":"Pa","kind":"idealization","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html","observedAt":null}
- temperature / earth.airTemperature: {"value":256.15,"unit":"K","kind":"weather-model","source":"https://www.meteomatics.com/en/api/getting-started/","observedAt":"2026-11-15T03:50:24Z"}
- temperature / earth.surfaceTemperature: {"minK":null,"maxK":null,"meanK":null,"kind":"unknown","source":null}
- temperature / target.surfaceTemperature: {"minK":null,"maxK":326.9,"meanK":137.8,"kind":"diviner","source":"LRO Diviner Polar Resource Product LRO-L-DLRE-5-PRP-V2.0 (Paige et al. 2010, Science 330:479), 46 celdas del modelo térmico ajustado dentro de la ventana; meanK = media anual, maxK = máximo anual. https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro\_diviner\_derived1/data\_derived\_prp/dlre\_prp\_south.tab"}
- heat-transfer / reference.thermal: "https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/"
- radiation / earth.ionizingDoseRate: {"value":null,"unit":"Sv/s","kind":"unknown","source":null,"observedAt":null}
- radiation / target.ionizingDoseRate: {"value":null,"unit":"Sv/s","kind":"unknown","source":null,"observedAt":null}
- radiation / reference.radiation: "https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/"

### earth

Telemetría: {"site":"wright-valley","lat":-77.5,"lon":161.82,"observedAt":"2026-11-15T03:50:24Z","fetchedAt":"2026-11-15T03:50:24Z","observationAgeSeconds":363,"provider":"meteomatics","live":true,"cached":true,"ageSeconds":363,"values":{"solarRadiationWm2":533,"temperatureC":-17,"windSpeedMs":1.2,"windGustMs":10.2,"relativeHumidityPct":42.1,"cloudCoverPct":50.1,"surfacePressurePa":85915,"windDirDeg":212.8,"precipMm":0},"source":{"label":"Meteomatics Weather API · modelo mix (now)","url":"https://www.meteomatics.com/en/api/getting-started/"}}
- Punto de referencia · data.js (Australian Antarctic Data Centre, registro geográfico): https://data.aad.gov.au/aadc/gaz/display\_name.cfm?gaz\_id=133876
- Copernicus DEM GLO-30 · tesela Copernicus\_DSM\_COG\_10\_S78\_00\_E161\_00\_DEM (Planetary Computer): https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus\_DSM\_COG\_10\_S78\_00\_E161\_00\_DEM
- Sentinel-2 L2A · S2B\_MSIL2A\_20260123T202619\_R042\_T57CWP\_20260123T214336 (2026-01-23): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B\_MSIL2A\_20260123T202619\_R042\_T57CWP\_20260123T214336
- Sentinel-1 RTC · S1D\_IW\_GRDH\_1SSH\_20261107T124725\_20261107T124759\_005361\_00A388\_rtc (2026-11-07): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1D\_IW\_GRDH\_1SSH\_20261107T124725\_20261107T124759\_005361\_00A388\_rtc
- Las coordenadas del registro AADC están redondeadas y su precisión figura como desconocida: la ventana es representativa del valle, no un punto de ensayo concreto.
- Centro de la ventana elegido con scripts/analog\_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (-77.517, 161.833), la de mayor índice geométrico frente a «Shackleton». Es una elección reproducible del equipo, no un punto de ensayo publicado. La ventana incluye la ladera norte del valle, el análogo de la pared interior del cráter.
- Rugosidad radar en polarización HH: en esta zona Sentinel-1 solo adquiere HH (modo polar), por lo que no es directamente comparable con valores VV.
- Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain\_metrics.bilinear\_resample. Fila 0 = norte, columna 0 = oeste.
- Métricas calculadas con scripts/terrain\_metrics.compute\_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).
- thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).
- La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria.

### target

Telemetría: desconocido
- LRO LOLA 5 m/pix LDEM, Site04 «Shackleton rim» (Barker et al. 2021, NASA GSFC PGDA): https://pgda.gsfc.nasa.gov/data/LOLA\_5mpp/Site04/Site04\_final\_adj\_5mpp\_surf.tif
- Catálogo / página del producto: https://pgda.gsfc.nasa.gov/products/78
- LRO Mini-RF Global Mosaic CPR 128 ppd (PDS Geosciences): https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-5-global-mosaic-v1/lromrf\_1001/data/128ppd/global\_cpr\_128ppd\_simp\_0c.img
- Térmica: LRO Diviner Polar Resource Product LRO-L-DLRE-5-PRP-V2.0: https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro\_diviner\_derived1/data\_derived\_prp/dlre\_prp\_south.tab
- Ventana centrada en la cresta del borde de Shackleton dentro del LDEM Site04 de PGDA (región de interés Artemis «Shackleton rim»); incluye la pared interior hacia la región en sombra permanente y el flanco exterior.
- Orientación: la rejilla se muestrea en un marco azimutal equidistante local, por lo que fila 0 = norte local verdadero (alejándose del polo) y columna 0 = oeste local, igual que en los otros objetivos; no es la orientación de la cuadrícula estereográfica polar del producto.
- Barker et al. (2021): ~90 % de los píxeles de 5 m están interpolados entre huellas LOLA; la resolución efectiva es más gruesa que 5 m, aunque el promedio a 18.75 m y la rejilla de 37.5 m quedan dentro de la escala que las pasadas LOLA resuelven cerca del polo.
- La imagen de contexto es un relieve sombreado calculado del propio LDEM (sol a 315°/35°), no una fotografía: el borde de Shackleton está casi siempre en iluminación rasante o sombra.
- Diviner PRP no publica la mínima anual por celda; minK = null. En las zonas en sombra permanente del interior del cráter Paige et al. (2010) reportan medias anuales \< 110 K, fuera de esta ventana de borde.
- Mini-RF CPR = 0.605 (mediana, 100% de nodos válidos). Píxel de ~237 m: valor regional, no por nodo; en latitudes polares el mosaico cilíndrico estira mucho en longitud. CPR alto (≳1) suele asociarse a superficies rocosas a escala de la longitud de onda (Cahill et al. 2014, Icarus).

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

Misión: 6e743737-e818-4764-b30b-5e24d252d135. Escenario: polar-shadow. Fase: exploration.
Inicio UTC: 2026-11-15T03:56:30.444Z. Fin UTC: 2026-11-15T03:56:44.402Z.
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
    "gridId": "wright-valley",
    "body": "earth",
    "profileId": "atlas-final-earth-v1",
    "grid": {
      "id": "wright-valley",
      "body": "earth",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 30,
      "center": [
        -77.5002,
        161.82369
      ],
      "dataset": "Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)",
      "source": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30",
      "fetchedAt": "2026-11-15T02:07:21+00:00",
      "sampling": null,
      "georeferencing": {
        "frame": "AEQD",
        "ellipsoid": "WGS84",
        "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
      },
      "notes": [
        "Las coordenadas del registro AADC están redondeadas y su precisión figura como desconocida: la ventana es representativa del valle, no un punto de ensayo concreto.",
        "Centro de la ventana elegido con scripts/analog_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (-77.517, 161.833), la de mayor índice geométrico frente a «Shackleton». Es una elección reproducible del equipo, no un punto de ensayo publicado. La ventana incluye la ladera norte del valle, el análogo de la pared interior del cráter.",
        "Rugosidad radar en polarización HH: en esta zona Sentinel-1 solo adquiere HH (modo polar), por lo que no es directamente comparable con valores VV.",
        "Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.",
        "Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).",
        "thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).",
        "La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria."
      ],
      "provenance": [
        {
          "label": "Punto de referencia · data.js (Australian Antarctic Data Centre, registro geográfico)",
          "url": "https://data.aad.gov.au/aadc/gaz/display_name.cfm?gaz_id=133876"
        },
        {
          "label": "Copernicus DEM GLO-30 · tesela Copernicus_DSM_COG_10_S78_00_E161_00_DEM (Planetary Computer)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus_DSM_COG_10_S78_00_E161_00_DEM"
        },
        {
          "label": "Sentinel-2 L2A · S2B_MSIL2A_20260123T202619_R042_T57CWP_20260123T214336 (2026-01-23)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_20260123T202619_R042_T57CWP_20260123T214336"
        },
        {
          "label": "Sentinel-1 RTC · S1D_IW_GRDH_1SSH_20261107T124725_20261107T124759_005361_00A388_rtc (2026-11-07)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1D_IW_GRDH_1SSH_20261107T124725_20261107T124759_005361_00A388_rtc"
        }
      ]
    },
    "sciencePoint": {
      "x": 0,
      "z": 0
    },
    "zones": [
      {
        "id": "wright-valley-r35-c47",
        "gridId": "wright-valley",
        "x": 562.5,
        "z": 112.5,
        "elevationM": 543.6,
        "slopeDeg": 6.454830247455114,
        "maxSlopeDeg": 7.560033216950377,
        "reliefM": 22.600000000000023,
        "scienceDistanceM": 573.6396952791883,
        "status": "candidate",
        "eligible": true,
        "score": 56.3,
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
          "latitude": -77.50120669424396,
          "longitude": 161.84696372058886,
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
        "id": "wright-valley-r25-c41",
        "gridId": "wright-valley",
        "x": 337.5,
        "z": -262.5,
        "elevationM": 577.2,
        "slopeDeg": 7.746181126276994,
        "maxSlopeDeg": 9.695598367598164,
        "reliefM": 22.59999999999991,
        "scienceDistanceM": 427.56578441217675,
        "status": "candidate",
        "eligible": true,
        "score": 51.4,
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
          "latitude": -77.49784835574977,
          "longitude": 161.8376505418962,
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
        "id": "wright-valley-r39-c55",
        "gridId": "wright-valley",
        "x": 862.5,
        "z": 262.5,
        "elevationM": 520,
        "slopeDeg": 7.207535232936656,
        "maxSlopeDeg": 13.064883588216485,
        "reliefM": 31.599999999999966,
        "scienceDistanceM": 901.561146012848,
        "status": "candidate",
        "eligible": true,
        "score": 47.2,
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
          "latitude": -77.5025489351049,
          "longitude": 161.8593801434066,
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
        "id": "wright-valley-r13-c43",
        "gridId": "wright-valley",
        "x": 412.5,
        "z": -712.5,
        "elevationM": 545,
        "slopeDeg": 8.584957850313002,
        "maxSlopeDeg": 11.72460548198177,
        "reliefM": 21.800000000000068,
        "scienceDistanceM": 823.2936900037556,
        "status": "caution",
        "eligible": true,
        "score": 46.2,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
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
          "latitude": -77.49381740365713,
          "longitude": 161.84074747422164,
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
        "id": "wright-valley-r3-c39",
        "gridId": "wright-valley",
        "x": 262.5,
        "z": -1087.5,
        "elevationM": 555.8,
        "slopeDeg": 9.267206065125778,
        "maxSlopeDeg": 11.023871945681904,
        "reliefM": 22,
        "scienceDistanceM": 1118.7325417632221,
        "status": "caution",
        "eligible": true,
        "score": 41.7,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
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
          "latitude": -77.49045874338417,
          "longitude": 161.8345418891754,
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
    "selectedId": "wright-valley-r35-c47",
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
    "simSeconds": 31.564120105266863,
    "x": 562.8770487057858,
    "z": 112.23917229708692,
    "yM": 543.5915145806753,
    "altitudeM": 0,
    "groundElevationM": 543.5915145806753,
    "verticalSpeedMs": -0.8456805725816141,
    "horizontalSpeedMs": 0.08224823938545828,
    "vxMs": -0.06764114983796676,
    "vyMs": -0.8456805725816141,
    "vzMs": 0.04679153481779989,
    "pitchDeg": -0.04730900688987448,
    "rollDeg": -0.06838915461493013,
    "thrustN": 0,
    "throttle": 0,
    "propellantKg": 499.61892106054887,
    "massKg": 1349.618921060549,
    "gravityMs2": 9.81,
    "weightN": 13239.761615603986,
    "positionErrorM": 0.45847226431012805,
    "target": {
      "id": "wright-valley-r35-c47",
      "gridId": "wright-valley",
      "x": 562.5,
      "z": 112.5,
      "elevationM": 543.6,
      "slopeDeg": 6.454830247455114,
      "maxSlopeDeg": 7.560033216950377,
      "reliefM": 22.600000000000023,
      "scienceDistanceM": 573.6396952791883,
      "status": "candidate",
      "eligible": true,
      "score": 56.3,
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
        "latitude": -77.50120669424396,
        "longitude": 161.84696372058886,
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
      "verticalSpeedMs": 0.8472116075614607,
      "horizontalSpeedMs": 0.08224823938545828,
      "tiltDeg": 0.08315776782853147,
      "positionErrorM": 0.45847226431012805,
      "slopeDeg": 2.964040411931283,
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
      "id": "wright-valley",
      "body": "earth",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 30,
      "center": [
        -77.5002,
        161.82369
      ],
      "dataset": "Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)",
      "source": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30",
      "fetchedAt": "2026-11-15T02:07:21+00:00",
      "sampling": null,
      "georeferencing": {
        "frame": "AEQD",
        "ellipsoid": "WGS84",
        "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
      },
      "notes": [
        "Las coordenadas del registro AADC están redondeadas y su precisión figura como desconocida: la ventana es representativa del valle, no un punto de ensayo concreto.",
        "Centro de la ventana elegido con scripts/analog_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (-77.517, 161.833), la de mayor índice geométrico frente a «Shackleton». Es una elección reproducible del equipo, no un punto de ensayo publicado. La ventana incluye la ladera norte del valle, el análogo de la pared interior del cráter.",
        "Rugosidad radar en polarización HH: en esta zona Sentinel-1 solo adquiere HH (modo polar), por lo que no es directamente comparable con valores VV.",
        "Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.",
        "Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).",
        "thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).",
        "La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria."
      ],
      "provenance": [
        {
          "label": "Punto de referencia · data.js (Australian Antarctic Data Centre, registro geográfico)",
          "url": "https://data.aad.gov.au/aadc/gaz/display_name.cfm?gaz_id=133876"
        },
        {
          "label": "Copernicus DEM GLO-30 · tesela Copernicus_DSM_COG_10_S78_00_E161_00_DEM (Planetary Computer)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus_DSM_COG_10_S78_00_E161_00_DEM"
        },
        {
          "label": "Sentinel-2 L2A · S2B_MSIL2A_20260123T202619_R042_T57CWP_20260123T214336 (2026-01-23)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_20260123T202619_R042_T57CWP_20260123T214336"
        },
        {
          "label": "Sentinel-1 RTC · S1D_IW_GRDH_1SSH_20261107T124725_20261107T124759_005361_00A388_rtc (2026-11-07)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1D_IW_GRDH_1SSH_20261107T124725_20261107T124759_005361_00A388_rtc"
        }
      ]
    },
    "georeference": {
      "latitude": -77.50120435659926,
      "longitude": 161.84697931688459,
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
    "gridId": "shackleton",
    "body": "moon",
    "profileId": "atlas-final-moon-v1",
    "grid": {
      "id": "shackleton",
      "body": "moon",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 5,
      "center": [
        -89.78306,
        -155.7435
      ],
      "dataset": "LRO LOLA 5 m/pix LDEM, Site04 «Shackleton rim» (Barker et al. 2021, NASA GSFC PGDA)",
      "source": "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif",
      "fetchedAt": "2026-11-14T17:17:12+00:00",
      "sampling": {
        "frame": "azimutal equidistante local (fila 0 = norte, columna 0 = oeste)",
        "preGrid": "129×129 a 18.75 m, promedio de área + bilineal",
        "resample": "terrain_metrics.bilinear_resample 129→65",
        "radiusMeters": 1737400,
        "elevationDatum": "altura relativa al radio/areoide de referencia del producto (m)"
      },
      "georeferencing": {
        "frame": "AEQD",
        "radiusMeters": 1737400,
        "source": "grid.sampling.frame/radiusMeters"
      },
      "notes": [
        "Ventana centrada en la cresta del borde de Shackleton dentro del LDEM Site04 de PGDA (región de interés Artemis «Shackleton rim»); incluye la pared interior hacia la región en sombra permanente y el flanco exterior.",
        "Orientación: la rejilla se muestrea en un marco azimutal equidistante local, por lo que fila 0 = norte local verdadero (alejándose del polo) y columna 0 = oeste local, igual que en los otros objetivos; no es la orientación de la cuadrícula estereográfica polar del producto.",
        "Barker et al. (2021): ~90 % de los píxeles de 5 m están interpolados entre huellas LOLA; la resolución efectiva es más gruesa que 5 m, aunque el promedio a 18.75 m y la rejilla de 37.5 m quedan dentro de la escala que las pasadas LOLA resuelven cerca del polo.",
        "La imagen de contexto es un relieve sombreado calculado del propio LDEM (sol a 315°/35°), no una fotografía: el borde de Shackleton está casi siempre en iluminación rasante o sombra.",
        "Diviner PRP no publica la mínima anual por celda; minK = null. En las zonas en sombra permanente del interior del cráter Paige et al. (2010) reportan medias anuales < 110 K, fuera de esta ventana de borde.",
        "Mini-RF CPR = 0.605 (mediana, 100% de nodos válidos). Píxel de ~237 m: valor regional, no por nodo; en latitudes polares el mosaico cilíndrico estira mucho en longitud. CPR alto (≳1) suele asociarse a superficies rocosas a escala de la longitud de onda (Cahill et al. 2014, Icarus)."
      ],
      "provenance": [
        {
          "label": "LRO LOLA 5 m/pix LDEM, Site04 «Shackleton rim» (Barker et al. 2021, NASA GSFC PGDA)",
          "url": "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif"
        },
        {
          "label": "Catálogo / página del producto",
          "url": "https://pgda.gsfc.nasa.gov/products/78"
        },
        {
          "label": "LRO Mini-RF Global Mosaic CPR 128 ppd (PDS Geosciences)",
          "url": "https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-5-global-mosaic-v1/lromrf_1001/data/128ppd/global_cpr_128ppd_simp_0c.img"
        },
        {
          "label": "Térmica: LRO Diviner Polar Resource Product LRO-L-DLRE-5-PRP-V2.0",
          "url": "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab"
        }
      ]
    },
    "sciencePoint": {
      "x": 0,
      "z": 0
    },
    "zones": [
      {
        "id": "shackleton-r23-c31",
        "gridId": "shackleton",
        "x": -37.5,
        "z": -337.5,
        "elevationM": 1732.33,
        "slopeDeg": 8.930898119555934,
        "maxSlopeDeg": 12.457552017705183,
        "reliefM": 21.700000000000045,
        "scienceDistanceM": 339.57694268015314,
        "status": "caution",
        "eligible": true,
        "score": 46.8,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 5,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -89.77192661062281,
          "longitude": -156.05417433046046,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 1737400,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "shackleton-r43-c35",
        "gridId": "shackleton",
        "x": 112.5,
        "z": 412.5,
        "elevationM": 1712.53,
        "slopeDeg": 10.024494759342051,
        "maxSlopeDeg": 13.869890022891946,
        "reliefM": 30.75999999999999,
        "scienceDistanceM": 427.5657844121767,
        "status": "caution",
        "eligible": true,
        "score": 36.9,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 5,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -89.79662953521964,
          "longitude": -154.69821411025134,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 1737400,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "shackleton-r15-c29",
        "gridId": "shackleton",
        "x": -112.5,
        "z": -637.5,
        "elevationM": 1727,
        "slopeDeg": 11.330489328787499,
        "maxSlopeDeg": 14.678666960331325,
        "reliefM": 23.559999999999945,
        "scienceDistanceM": 647.3503688112025,
        "status": "caution",
        "eligible": true,
        "score": 33.5,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 5,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -89.7620076786188,
          "longitude": -156.63671057278532,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 1737400,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "shackleton-r51-c37",
        "gridId": "shackleton",
        "x": 187.5,
        "z": 712.5,
        "elevationM": 1694.4,
        "slopeDeg": 11.395760729628494,
        "maxSlopeDeg": 17.34655125818428,
        "reliefM": 31.4699999999998,
        "scienceDistanceM": 736.7581014145687,
        "status": "caution",
        "eligible": true,
        "score": 29.2,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 5,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -89.80645794513927,
          "longitude": -153.91267812220735,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 1737400,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "shackleton-r61-c39",
        "gridId": "shackleton",
        "x": 262.5,
        "z": 1087.5,
        "elevationM": 1663.66,
        "slopeDeg": 11.695863873683933,
        "maxSlopeDeg": 13.510010809410579,
        "reliefM": 28.789999999999964,
        "scienceDistanceM": 1118.7325417632221,
        "status": "caution",
        "eligible": true,
        "score": 27.2,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 5,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -89.81871664578264,
          "longitude": -153.00645011563506,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 1737400,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      }
    ],
    "selectedId": "shackleton-r23-c31",
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
      "Vacío lunar ideal: no se modelan interacción de pluma, regolito ni sombras como navegación."
    ],
    "errors": []
  },
  "run": {
    "schema": "LandingRunSummary",
    "version": "1.0.0",
    "body": "moon",
    "profileId": "atlas-final-moon-v1",
    "phase": "contact",
    "guidanceStage": "terminal",
    "simSeconds": 41.08634395463453,
    "x": -37.65166625597791,
    "z": -337.40346068007693,
    "yM": 1732.3364441273138,
    "altitudeM": 0,
    "groundElevationM": 1732.3364441273138,
    "verticalSpeedMs": -0.8491856013199717,
    "horizontalSpeedMs": 0.03818516542951207,
    "vxMs": 0.03205986767407088,
    "vyMs": -0.8491856013199717,
    "vzMs": -0.020742992638485627,
    "pitchDeg": 0.1634298963789378,
    "rollDeg": 0.2444986049958154,
    "thrustN": 0,
    "throttle": 0,
    "propellantKg": 155.02953928359784,
    "massKg": 1005.0295392835978,
    "gravityMs2": 1.62,
    "weightN": 1628.1478536394286,
    "positionErrorM": 0.17978457523815733,
    "target": {
      "id": "shackleton-r23-c31",
      "gridId": "shackleton",
      "x": -37.5,
      "z": -337.5,
      "elevationM": 1732.33,
      "slopeDeg": 8.930898119555934,
      "maxSlopeDeg": 12.457552017705183,
      "reliefM": 21.700000000000045,
      "scienceDistanceM": 339.57694268015314,
      "status": "caution",
      "eligible": true,
      "score": 46.8,
      "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
      "scaleMeters": 225,
      "neighborhoodRadiusM": 112.5,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 5,
      "coverage": 1,
      "sciencePoint": {
        "x": 0,
        "z": 0
      },
      "georeference": {
        "latitude": -89.77192661062281,
        "longitude": -156.05417433046046,
        "kind": "model-projection-inverse",
        "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
        "reference": {
          "frame": "AEQD",
          "radiusMeters": 1737400,
          "source": "grid.sampling.frame/radiusMeters"
        },
        "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
      }
    },
    "contact": {
      "verticalSpeedMs": 0.8478121204082518,
      "horizontalSpeedMs": 0.03818516542951207,
      "tiltDeg": 0.2940888477733782,
      "positionErrorM": 0.17978457523815733,
      "slopeDeg": 2.311262122160946,
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
        "Vacío lunar ideal: no se modelan interacción de pluma, regolito ni sombras como navegación."
      ],
      "propellantKg": 180,
      "thrustMaxN": 6000,
      "label": "Luna · descenso final idealizado",
      "id": "atlas-final-moon-v1",
      "body": "moon",
      "gravityMs2": 1.62
    },
    "grid": {
      "id": "shackleton",
      "body": "moon",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 5,
      "center": [
        -89.78306,
        -155.7435
      ],
      "dataset": "LRO LOLA 5 m/pix LDEM, Site04 «Shackleton rim» (Barker et al. 2021, NASA GSFC PGDA)",
      "source": "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif",
      "fetchedAt": "2026-11-14T17:17:12+00:00",
      "sampling": {
        "frame": "azimutal equidistante local (fila 0 = norte, columna 0 = oeste)",
        "preGrid": "129×129 a 18.75 m, promedio de área + bilineal",
        "resample": "terrain_metrics.bilinear_resample 129→65",
        "radiusMeters": 1737400,
        "elevationDatum": "altura relativa al radio/areoide de referencia del producto (m)"
      },
      "georeferencing": {
        "frame": "AEQD",
        "radiusMeters": 1737400,
        "source": "grid.sampling.frame/radiusMeters"
      },
      "notes": [
        "Ventana centrada en la cresta del borde de Shackleton dentro del LDEM Site04 de PGDA (región de interés Artemis «Shackleton rim»); incluye la pared interior hacia la región en sombra permanente y el flanco exterior.",
        "Orientación: la rejilla se muestrea en un marco azimutal equidistante local, por lo que fila 0 = norte local verdadero (alejándose del polo) y columna 0 = oeste local, igual que en los otros objetivos; no es la orientación de la cuadrícula estereográfica polar del producto.",
        "Barker et al. (2021): ~90 % de los píxeles de 5 m están interpolados entre huellas LOLA; la resolución efectiva es más gruesa que 5 m, aunque el promedio a 18.75 m y la rejilla de 37.5 m quedan dentro de la escala que las pasadas LOLA resuelven cerca del polo.",
        "La imagen de contexto es un relieve sombreado calculado del propio LDEM (sol a 315°/35°), no una fotografía: el borde de Shackleton está casi siempre en iluminación rasante o sombra.",
        "Diviner PRP no publica la mínima anual por celda; minK = null. En las zonas en sombra permanente del interior del cráter Paige et al. (2010) reportan medias anuales < 110 K, fuera de esta ventana de borde.",
        "Mini-RF CPR = 0.605 (mediana, 100% de nodos válidos). Píxel de ~237 m: valor regional, no por nodo; en latitudes polares el mosaico cilíndrico estira mucho en longitud. CPR alto (≳1) suele asociarse a superficies rocosas a escala de la longitud de onda (Cahill et al. 2014, Icarus)."
      ],
      "provenance": [
        {
          "label": "LRO LOLA 5 m/pix LDEM, Site04 «Shackleton rim» (Barker et al. 2021, NASA GSFC PGDA)",
          "url": "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif"
        },
        {
          "label": "Catálogo / página del producto",
          "url": "https://pgda.gsfc.nasa.gov/products/78"
        },
        {
          "label": "LRO Mini-RF Global Mosaic CPR 128 ppd (PDS Geosciences)",
          "url": "https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-5-global-mosaic-v1/lromrf_1001/data/128ppd/global_cpr_128ppd_simp_0c.img"
        },
        {
          "label": "Térmica: LRO Diviner Polar Resource Product LRO-L-DLRE-5-PRP-V2.0",
          "url": "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab"
        }
      ]
    },
    "georeference": {
      "latitude": -89.77192976706519,
      "longitude": -156.0554351615906,
      "kind": "model-projection-inverse",
      "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
      "reference": {
        "frame": "AEQD",
        "radiusMeters": 1737400,
        "source": "grid.sampling.frame/radiusMeters"
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
      "Vacío lunar ideal: no se modelan interacción de pluma, regolito ni sombras como navegación."
    ]
  }
}
```
Historial: 54 muestras; eventos: 8. UTC y SIM descenso independientes del rover ×20.
- Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.
- Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.
- El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.
- Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.
- La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.
- Tierra es una comparación virtual sin aerodinámica, no un ensayo físico terrestre.
- Vacío lunar ideal: no se modelan interacción de pluma, regolito ni sombras como navegación.
- Heurística regional determinista, sin probabilidad de éxito ni zona segura certificada.
- Navegación idealizada con posición exacta; no implementa visión, TRN, SPLICE ni detección de obstáculos.
- Coordenadas locales x este, z sur, y altura DEM, en metros SI; exageración gráfica ×2 excluida de la física.
- Punto científico y contacto son distintos; la separación nominal no representa el contorno de un pozo.
- Evaluación regional: DEM de 37,5 m no resuelve patas, rocas ni la geometría del pozo.
- Tierra es una comparación virtual, no un ensayo físico; navegación idealizada sin TRN ni visión implementada.
- Relieve visual ×2; dinámica SI y altitud AGL sin exageración.


## Presentación del banco 3D

Modo: misma masa con soporte vertical. Factor: gravity. Referencia visual: perseverance. Mallas normalizadas; no son fuente científica ni equivalencia física global.
