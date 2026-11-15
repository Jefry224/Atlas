# Dossier local · Planicie hiperárida y salina

Contrato 1.0.0 · Auditor 1.0.0 · 2026-11-14T20:00:36.500Z

Atacama · Sitio de ensayo ARADS ↔ Cráter Jezero · zona de aterrizaje de Perseverance (Octavia E. Butler)

Auditoría exploratoria local; no certifica similitud física, seguridad ni aptitud de misión. Parámetros de calculadora son hipótesis del usuario.

## Strength vs. Breakdown

| Parámetro | Estado | Fortaleza | Ruptura | Acción |
| --- | --- | --- | --- | --- |
| Escala regional | valid | Misma ventana y muestreo: comparación regional reproducible. | La rejilla no resuelve contactos rueda/suelo, rocas ni cavidades; resolución nativa e interpolación limitan el ensayo. | Medir a la escala del instrumento antes de diseñar el ensayo. |
| Relieve · Strength vs. Breakdown | partial | Índice geométrico 82/100; pendientes, desnivel y TRI documentados. | El índice no mide similitud física; rugosidad radar dB y CPR no son intercambiables. | Usar componentes y advertencias para elegir tareas, sin umbral universal de validez. |
| Gravedad y carga estática | breakdown | Se puede ajustar la carga estática con un soporte vertical para una masa explícita. | La gravedad reducida no se reproduce en campo terrestre; descargar peso conserva la masa y su inercia. | Calcular F=m·g y descarga; validar dinámica y terramecánica por separado. |
| Atmósfera y vacío | breakdown | El terreno permite ensayar geometría y procedimientos al aire libre. | La atmósfera terrestre no reproduce el gas CO₂ tenue de Marte. La referencia de presión no es una medición del sitio. | Ensayar en cámara con composición/presión controladas; ningún escalar convierte aire terrestre en el objetivo. |
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
  "targetBody": "mars",
  "inputs": {
    "massKg": 350,
    "earthGravityMs2": 9.81,
    "targetGravityMs2": 3.71,
    "earthPressurePa": null,
    "targetPressurePa": 636,
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
    "targetWeightN": 1298.5,
    "targetToEarthRatio": 0.3781855249745158,
    "offloadForceN": 2135,
    "equivalentEarthMassKg": 132.36493374108053
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
      "value": 3.71,
      "unit": "m/s²",
      "kind": "reference",
      "source": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
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
      "value": 636,
      "unit": "Pa",
      "kind": "reference",
      "source": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
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

- scale / earth.grid: {"gridSize":65,"spacingMeters":37.5,"extentMeters":2400,"nativeResolutionMeters":30,"dataset":"Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)","source":"https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30","fetchedAt":"2026-11-15T02:07:24+00:00","license":"https://spacedata.copernicus.eu/documents/20126/0/CSCDA\_ESA\_Mission-specific+Annex.pdf","credit":"© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"}
- scale / target.grid: {"gridSize":65,"spacingMeters":37.5,"extentMeters":2400,"nativeResolutionMeters":1.02,"dataset":"MRO HiRISE DTM DTEEC\_045994\_1985\_046060\_1985\_U01 (Univ. of Arizona / USGS, 1 m/px)","source":"https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP\_045994\_1985\_ESP\_046060\_1985/DTEEC\_045994\_1985\_046060\_1985\_U01.tif","fetchedAt":"2026-11-14T17:15:29+00:00","license":null,"credit":null}
- geometry / geometry: {"index":82,"comparable":true,"components":\[{"key":"slopeP50Deg","label":"Pendiente mediana (p50)","unit":"°","earth":2.38,"target":1.97,"score":82.8,"weight":0.3333333333333333},{"key":"slopeP90Deg","label":"Pendiente p90","unit":"°","earth":4.58,"target":4.32,"score":94.3,"weight":0.2777777777777778},{"key":"reliefP95P5M","label":"Desnivel p95–p5","unit":"m","earth":68.66,"target":47.41,"score":69.1,"weight":0.22222222222222224},{"key":"triMeanM","label":"TRI medio","unit":"m","earth":1.56,"target":1.24,"score":79.5,"weight":0.16666666666666666}\],"caveats":\["Índice de similitud geométrica, no planetaria: la geometría del relieve no reproduce gravedad, regolito, iluminación ni química.","Rugosidad radar no disponible en ambos sitios: no entra en el índice.","Pesos editoriales del prototipo, no calibrados frente a misiones reales."\]}
- gravity / earth.gravity: {"value":9.81,"unit":"m/s²","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html","observedAt":null}
- gravity / target.gravity: {"value":3.71,"unit":"m/s²","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html","observedAt":null}
- atmosphere / target.pressure: {"value":636,"unit":"Pa","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html","observedAt":null}
- atmosphere / reference.atmosphere: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html"
- pressure / earth.pressure: {"value":null,"unit":"Pa","kind":"unknown","source":null,"observedAt":null}
- pressure / target.pressure: {"value":636,"unit":"Pa","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html","observedAt":null}
- temperature / earth.airTemperature: {"value":null,"unit":"K","kind":"unknown","source":null,"observedAt":null}
- temperature / earth.surfaceTemperature: {"minK":null,"maxK":null,"meanK":null,"kind":"unknown","source":null}
- temperature / target.surfaceTemperature: {"minK":187.8,"maxK":286.1,"meanK":223.7,"kind":"model","source":"Mars Climate Database v6.2 (LMD/OU/IAA/ESA/CNES), escenario climatológico, temperatura de superficie en 18.4447°N 77.4508°E; curve = Ls 0° (equinoccio de primavera boreal) por hora solar local marciana; min/max/mean sobre Ls 0/90/180/270 × 24 h. http://www-mars.lmd.jussieu.fr/mcd\_python/cgi-bin/mcdcgi.py"}
- heat-transfer / reference.thermal: "https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/"
- radiation / earth.ionizingDoseRate: {"value":null,"unit":"Sv/s","kind":"unknown","source":null,"observedAt":null}
- radiation / target.ionizingDoseRate: {"value":null,"unit":"Sv/s","kind":"unknown","source":null,"observedAt":null}
- radiation / reference.radiation: "https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/"

### earth

Telemetría: desconocido
- Punto de referencia · data.js (Astrobiology · Ensayo ARADS y localización): https://pmc.ncbi.nlm.nih.gov/articles/PMC10750310/
- Copernicus DEM GLO-30 · tesela Copernicus\_DSM\_COG\_10\_S25\_00\_W071\_00\_DEM (Planetary Computer): https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus\_DSM\_COG\_10\_S25\_00\_W071\_00\_DEM
- Sentinel-2 L2A · S2B\_MSIL2A\_20261113T143649\_R096\_T19KCP\_20261113T181914 (2026-11-13): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B\_MSIL2A\_20261113T143649\_R096\_T19KCP\_20261113T181914
- Sentinel-1 RTC · S1C\_IW\_GRDH\_1SDV\_20261112T100910\_20261112T100935\_010302\_014934\_rtc (2026-11-12): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C\_IW\_GRDH\_1SDV\_20261112T100910\_20261112T100935\_010302\_014934\_rtc
- El marcador de ARADS en data.js es orientativo; la ventana muestra el entorno, no el punto exacto de perforación.
- Centro de la ventana elegido con scripts/analog\_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (-24.102, -70.138), la de mayor índice geométrico frente a «Jezero». Es una elección reproducible del equipo, no un punto de ensayo publicado.
- Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain\_metrics.bilinear\_resample. Fila 0 = norte, columna 0 = oeste.
- Métricas calculadas con scripts/terrain\_metrics.compute\_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).
- thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).
- La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria.

### target

Telemetría: desconocido
- MRO HiRISE DTM DTEEC\_045994\_1985\_046060\_1985\_U01 (Univ. of Arizona / USGS, 1 m/px): https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP\_045994\_1985\_ESP\_046060\_1985/DTEEC\_045994\_1985\_046060\_1985\_U01.tif
- Catálogo / página del producto: https://stac.astrogeology.usgs.gov/api/collections/mro\_hirise\_socet\_dtms/items/DTEEC\_045994\_1985\_046060\_1985\_U01
- Térmica: Mars Climate Database v6.2: http://www-mars.lmd.jussieu.fr/mcd\_python/cgi-bin/mcdcgi.py
- Imagen de contexto: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP\_045994\_1985\_ESP\_046060\_1985/ESP\_045994\_1985\_RED\_C\_01\_ORTHO.tif
- Centro en el sitio de aterrizaje Octavia E. Butler (18.4447°N, 77.4508°E); el frente del delta queda ~2 km al oeste, en el borde de la ventana.
- HiRISE DTM a 1 m promediado a celdas de 18.75 m antes de la rejilla de 37.5 m: la rugosidad métrica (rocas, megaripples) desaparece del índice geométrico.
- Elevación relativa al areoide/esfera de referencia de Marte del producto PDS (valores negativos ~-2.5 km son normales en Jezero).
- Térmica: Mars Climate Database (modelo, celda de varios km), no medición MEDA/Perseverance; queda como propuesta integrar series MEDA del PDS Atmospheres Node.
- Rugosidad: sin dato de radar equivalente; metrics.roughness = null.

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

Misión: evidence-hyperarid-salt-nominal. Escenario: hyperarid-salt. Fase: contact.
Inicio UTC: 2026-11-14T20:00:00.000Z. Fin UTC: 2026-11-14T20:00:36.500Z.
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
    "gridId": "atacama",
    "body": "earth",
    "profileId": "atlas-final-earth-v1",
    "grid": {
      "id": "atacama",
      "body": "earth",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 30,
      "center": [
        -24.10945,
        -70.10923
      ],
      "dataset": "Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)",
      "source": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30",
      "fetchedAt": "2026-11-15T02:07:24+00:00",
      "sampling": null,
      "georeferencing": {
        "frame": "AEQD",
        "ellipsoid": "WGS84",
        "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
      },
      "notes": [
        "El marcador de ARADS en data.js es orientativo; la ventana muestra el entorno, no el punto exacto de perforación.",
        "Centro de la ventana elegido con scripts/analog_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (-24.102, -70.138), la de mayor índice geométrico frente a «Jezero». Es una elección reproducible del equipo, no un punto de ensayo publicado.",
        "Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.",
        "Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).",
        "thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).",
        "La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria."
      ],
      "provenance": [
        {
          "label": "Punto de referencia · data.js (Astrobiology · Ensayo ARADS y localización)",
          "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10750310/"
        },
        {
          "label": "Copernicus DEM GLO-30 · tesela Copernicus_DSM_COG_10_S25_00_W071_00_DEM (Planetary Computer)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus_DSM_COG_10_S25_00_W071_00_DEM"
        },
        {
          "label": "Sentinel-2 L2A · S2B_MSIL2A_20261113T143649_R096_T19KCP_20261113T181914 (2026-11-13)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_20261113T143649_R096_T19KCP_20261113T181914"
        },
        {
          "label": "Sentinel-1 RTC · S1C_IW_GRDH_1SDV_20261112T100910_20261112T100935_010302_014934_rtc (2026-11-12)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C_IW_GRDH_1SDV_20261112T100910_20261112T100935_010302_014934_rtc"
        }
      ]
    },
    "sciencePoint": {
      "x": 0,
      "z": 0
    },
    "zones": [
      {
        "id": "atacama-r17-c17",
        "gridId": "atacama",
        "x": -562.5,
        "z": -562.5,
        "elevationM": 1026.4,
        "slopeDeg": 0.7790247854477753,
        "maxSlopeDeg": 1.0802515617107178,
        "reliefM": 2.099999999999909,
        "scienceDistanceM": 795.495128834866,
        "status": "candidate",
        "eligible": true,
        "score": 92,
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
          "latitude": -24.10437134088911,
          "longitude": -70.114762630327,
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
        "id": "atacama-r15-c43",
        "gridId": "atacama",
        "x": 412.5,
        "z": -637.5,
        "elevationM": 1022,
        "slopeDeg": 1.0693970206331866,
        "maxSlopeDeg": 1.3052017956727011,
        "reliefM": 3.1000000000000227,
        "scienceDistanceM": 759.317127424372,
        "status": "candidate",
        "eligible": true,
        "score": 90.3,
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
          "latitude": -24.103694245733333,
          "longitude": -70.10517275909405,
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
        "id": "atacama-r19-c9",
        "gridId": "atacama",
        "x": -862.5,
        "z": -487.5,
        "elevationM": 1025.5,
        "slopeDeg": 1.1634444833713746,
        "maxSlopeDeg": 1.4491722046174205,
        "reliefM": 2.3999999999998636,
        "scienceDistanceM": 990.738361021718,
        "status": "candidate",
        "eligible": true,
        "score": 89.4,
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
          "latitude": -24.1050483469577,
          "longitude": -70.11771341110585,
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
        "id": "atacama-r11-c23",
        "gridId": "atacama",
        "x": -337.5,
        "z": -787.5,
        "elevationM": 1024.6,
        "slopeDeg": 1.3832921048791218,
        "maxSlopeDeg": 1.8455149263924429,
        "reliefM": 3.7999999999999545,
        "scienceDistanceM": 856.7744744096897,
        "status": "candidate",
        "eligible": true,
        "score": 88,
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
          "latitude": -24.102339980460393,
          "longitude": -70.11254952583147,
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
        "id": "atacama-r15-c51",
        "gridId": "atacama",
        "x": 712.5,
        "z": -637.5,
        "elevationM": 1021.6,
        "slopeDeg": 1.4491722046174205,
        "maxSlopeDeg": 1.8581036433109135,
        "reliefM": 4.100000000000023,
        "scienceDistanceM": 956.0661587986472,
        "status": "candidate",
        "eligible": true,
        "score": 87.6,
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
          "latitude": -24.103694138905233,
          "longitude": -70.1022220384391,
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
    "selectedId": "atacama-r17-c17",
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
    "simSeconds": 31.59543963670762,
    "x": -562.1237275698737,
    "z": -562.7602050893192,
    "yM": 1026.4010782475677,
    "altitudeM": 0,
    "groundElevationM": 1026.4010782475677,
    "verticalSpeedMs": -0.8466299110452336,
    "horizontalSpeedMs": 0.08204841230697331,
    "vxMs": -0.06748399506922895,
    "vyMs": -0.8466299110452336,
    "vzMs": 0.046667465879254404,
    "pitchDeg": -0.04713384923924638,
    "rollDeg": -0.0681583699273616,
    "thrustN": 0,
    "throttle": 0,
    "propellantKg": 499.4799275604255,
    "massKg": 1349.4799275604255,
    "gravityMs2": 9.81,
    "weightN": 13238.398089367774,
    "positionErrorM": 0.4574796500181945,
    "target": {
      "id": "atacama-r17-c17",
      "gridId": "atacama",
      "x": -562.5,
      "z": -562.5,
      "elevationM": 1026.4,
      "slopeDeg": 0.7790247854477753,
      "maxSlopeDeg": 1.0802515617107178,
      "reliefM": 2.099999999999909,
      "scienceDistanceM": 795.495128834866,
      "status": "candidate",
      "eligible": true,
      "score": 92,
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
        "latitude": -24.10437134088911,
        "longitude": -70.114762630327,
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
      "verticalSpeedMs": 0.8464365286383844,
      "horizontalSpeedMs": 0.08204841230697331,
      "tiltDeg": 0.08286832291952731,
      "positionErrorM": 0.4574796500181945,
      "slopeDeg": 0.4831489839998777,
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
      "id": "atacama",
      "body": "earth",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 30,
      "center": [
        -24.10945,
        -70.10923
      ],
      "dataset": "Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)",
      "source": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30",
      "fetchedAt": "2026-11-15T02:07:24+00:00",
      "sampling": null,
      "georeferencing": {
        "frame": "AEQD",
        "ellipsoid": "WGS84",
        "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
      },
      "notes": [
        "El marcador de ARADS en data.js es orientativo; la ventana muestra el entorno, no el punto exacto de perforación.",
        "Centro de la ventana elegido con scripts/analog_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (-24.102, -70.138), la de mayor índice geométrico frente a «Jezero». Es una elección reproducible del equipo, no un punto de ensayo publicado.",
        "Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.",
        "Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).",
        "thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).",
        "La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria."
      ],
      "provenance": [
        {
          "label": "Punto de referencia · data.js (Astrobiology · Ensayo ARADS y localización)",
          "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10750310/"
        },
        {
          "label": "Copernicus DEM GLO-30 · tesela Copernicus_DSM_COG_10_S25_00_W071_00_DEM (Planetary Computer)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus_DSM_COG_10_S25_00_W071_00_DEM"
        },
        {
          "label": "Sentinel-2 L2A · S2B_MSIL2A_20261113T143649_R096_T19KCP_20261113T181914 (2026-11-13)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_20261113T143649_R096_T19KCP_20261113T181914"
        },
        {
          "label": "Sentinel-1 RTC · S1C_IW_GRDH_1SDV_20261112T100910_20261112T100935_010302_014934_rtc (2026-11-12)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C_IW_GRDH_1SDV_20261112T100910_20261112T100935_010302_014934_rtc"
        }
      ]
    },
    "georeference": {
      "latitude": -24.10436899174781,
      "longitude": -70.11475892929053,
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
Perfil de nave separado del rover de 350 kg: atlas-final-mars-v1.
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
      "Marte omite atmósfera y viento en este tramo idealizado; no reproduce entrada, paracaídas ni EDL marciano."
    ],
    "propellantKg": 260,
    "thrustMaxN": 10000,
    "label": "Marte · tramo propulsado final",
    "id": "atlas-final-mars-v1",
    "body": "mars",
    "gravityMs2": 3.71
  },
  "plan": {
    "schema": "LandingZonePlan",
    "version": "1.0.0",
    "gridId": "jezero",
    "body": "mars",
    "profileId": "atlas-final-mars-v1",
    "grid": {
      "id": "jezero",
      "body": "mars",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 1.02,
      "center": [
        18.4447,
        77.4508
      ],
      "dataset": "MRO HiRISE DTM DTEEC_045994_1985_046060_1985_U01 (Univ. of Arizona / USGS, 1 m/px)",
      "source": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_045994_1985_ESP_046060_1985/DTEEC_045994_1985_046060_1985_U01.tif",
      "fetchedAt": "2026-11-14T17:15:29+00:00",
      "sampling": {
        "frame": "azimutal equidistante local (fila 0 = norte, columna 0 = oeste)",
        "preGrid": "129×129 a 18.75 m, promedio de área + bilineal",
        "resample": "terrain_metrics.bilinear_resample 129→65",
        "radiusMeters": 3396190,
        "elevationDatum": "altura relativa al radio/areoide de referencia del producto (m)"
      },
      "georeferencing": {
        "frame": "AEQD",
        "radiusMeters": 3396190,
        "source": "grid.sampling.frame/radiusMeters"
      },
      "notes": [
        "Centro en el sitio de aterrizaje Octavia E. Butler (18.4447°N, 77.4508°E); el frente del delta queda ~2 km al oeste, en el borde de la ventana.",
        "HiRISE DTM a 1 m promediado a celdas de 18.75 m antes de la rejilla de 37.5 m: la rugosidad métrica (rocas, megaripples) desaparece del índice geométrico.",
        "Elevación relativa al areoide/esfera de referencia de Marte del producto PDS (valores negativos ~-2.5 km son normales en Jezero).",
        "Térmica: Mars Climate Database (modelo, celda de varios km), no medición MEDA/Perseverance; queda como propuesta integrar series MEDA del PDS Atmospheres Node.",
        "Rugosidad: sin dato de radar equivalente; metrics.roughness = null."
      ],
      "provenance": [
        {
          "label": "MRO HiRISE DTM DTEEC_045994_1985_046060_1985_U01 (Univ. of Arizona / USGS, 1 m/px)",
          "url": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_045994_1985_ESP_046060_1985/DTEEC_045994_1985_046060_1985_U01.tif"
        },
        {
          "label": "Catálogo / página del producto",
          "url": "https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms/items/DTEEC_045994_1985_046060_1985_U01"
        },
        {
          "label": "Térmica: Mars Climate Database v6.2",
          "url": "http://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py"
        },
        {
          "label": "Imagen de contexto",
          "url": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_045994_1985_ESP_046060_1985/ESP_045994_1985_RED_C_01_ORTHO.tif"
        }
      ]
    },
    "sciencePoint": {
      "x": 0,
      "z": 0
    },
    "zones": [
      {
        "id": "jezero-r25-c49",
        "gridId": "jezero",
        "x": 637.5,
        "z": -262.5,
        "elevationM": -2572.74,
        "slopeDeg": 1.0182042849766872,
        "maxSlopeDeg": 2.8203858707731757,
        "reliefM": 1.8699999999998909,
        "scienceDistanceM": 689.4291116568838,
        "status": "candidate",
        "eligible": true,
        "score": 91.5,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 1.02,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 18.44912819707855,
          "longitude": 77.46213771219868,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 3396190,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "jezero-r29-c41",
        "gridId": "jezero",
        "x": 337.5,
        "z": -112.5,
        "elevationM": -2571.09,
        "slopeDeg": 1.8016009110841036,
        "maxSlopeDeg": 2.4194309761179205,
        "reliefM": 2.7199999999998,
        "scienceDistanceM": 355.7562367689427,
        "status": "candidate",
        "eligible": true,
        "score": 88.8,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 1.02,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 18.44659784868381,
          "longitude": 77.45680222979922,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 3396190,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "jezero-r61-c13",
        "gridId": "jezero",
        "x": -712.5,
        "z": 1087.5,
        "elevationM": -2571.08,
        "slopeDeg": 1.2450088511624449,
        "maxSlopeDeg": 1.7649285659855547,
        "reliefM": 2.8900000000003274,
        "scienceDistanceM": 1300.1201867519787,
        "status": "candidate",
        "eligible": true,
        "score": 87.6,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 1.02,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 18.426352796859977,
          "longitude": 77.43813011867655,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 3396190,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "jezero-r23-c29",
        "gridId": "jezero",
        "x": -112.5,
        "z": -337.5,
        "elevationM": -2571.87,
        "slopeDeg": 2.0160368896209304,
        "maxSlopeDeg": 3.1321741698995913,
        "reliefM": 4.300000000000182,
        "scienceDistanceM": 355.7562367689427,
        "status": "candidate",
        "eligible": true,
        "score": 87.4,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 1.02,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 18.45039381865394,
          "longitude": 77.44879921251697,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 3396190,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      },
      {
        "id": "jezero-r3-c3",
        "gridId": "jezero",
        "x": -1087.5,
        "z": -1087.5,
        "elevationM": -2546.29,
        "slopeDeg": 1.2560158996545867,
        "maxSlopeDeg": 1.812695500695578,
        "reliefM": 3.4100000000003092,
        "scienceDistanceM": 1537.957249080741,
        "status": "candidate",
        "eligible": true,
        "score": 86.1,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 1.02,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": 18.46304580266685,
          "longitude": 77.43145762912275,
          "kind": "model-projection-inverse",
          "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
          "reference": {
            "frame": "AEQD",
            "radiusMeters": 3396190,
            "source": "grid.sampling.frame/radiusMeters"
          },
          "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
        }
      }
    ],
    "selectedId": "jezero-r25-c49",
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
      "Marte omite atmósfera y viento en este tramo idealizado; no reproduce entrada, paracaídas ni EDL marciano."
    ],
    "errors": []
  },
  "run": {
    "schema": "LandingRunSummary",
    "version": "1.0.0",
    "body": "mars",
    "profileId": "atlas-final-mars-v1",
    "phase": "contact",
    "guidanceStage": "terminal",
    "simSeconds": 36.02447597980508,
    "x": 637.7532123528485,
    "z": -262.66520736076035,
    "yM": -2572.7385919677517,
    "altitudeM": 0,
    "groundElevationM": -2572.7385919677517,
    "verticalSpeedMs": -0.8482949320250183,
    "horizontalSpeedMs": 0.05628403313196335,
    "vxMs": -0.04713822397095678,
    "vyMs": -0.8482949320250183,
    "vzMs": 0.03075516585004644,
    "pitchDeg": -0.08609710682753922,
    "rollDeg": -0.13195994759970964,
    "thrustN": 0,
    "throttle": 0,
    "propellantKg": 209.22749407152438,
    "massKg": 1059.2274940715245,
    "gravityMs2": 3.71,
    "weightN": 3929.7340030053556,
    "positionErrorM": 0.3023408137921482,
    "target": {
      "id": "jezero-r25-c49",
      "gridId": "jezero",
      "x": 637.5,
      "z": -262.5,
      "elevationM": -2572.74,
      "slopeDeg": 1.0182042849766872,
      "maxSlopeDeg": 2.8203858707731757,
      "reliefM": 1.8699999999998909,
      "scienceDistanceM": 689.4291116568838,
      "status": "candidate",
      "eligible": true,
      "score": 91.5,
      "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
      "scaleMeters": 225,
      "neighborhoodRadiusM": 112.5,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 1.02,
      "coverage": 1,
      "sciencePoint": {
        "x": 0,
        "z": 0
      },
      "georeference": {
        "latitude": 18.44912819707855,
        "longitude": 77.46213771219868,
        "kind": "model-projection-inverse",
        "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
        "reference": {
          "frame": "AEQD",
          "radiusMeters": 3396190,
          "source": "grid.sampling.frame/radiusMeters"
        },
        "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
      }
    },
    "contact": {
      "verticalSpeedMs": 0.8480329777893737,
      "horizontalSpeedMs": 0.05628403313196335,
      "tiltDeg": 0.15756296248738355,
      "positionErrorM": 0.3023408137921482,
      "slopeDeg": 0.505755641803572,
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
        "Marte omite atmósfera y viento en este tramo idealizado; no reproduce entrada, paracaídas ni EDL marciano."
      ],
      "propellantKg": 260,
      "thrustMaxN": 10000,
      "label": "Marte · tramo propulsado final",
      "id": "atlas-final-mars-v1",
      "body": "mars",
      "gravityMs2": 3.71
    },
    "grid": {
      "id": "jezero",
      "body": "mars",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 1.02,
      "center": [
        18.4447,
        77.4508
      ],
      "dataset": "MRO HiRISE DTM DTEEC_045994_1985_046060_1985_U01 (Univ. of Arizona / USGS, 1 m/px)",
      "source": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_045994_1985_ESP_046060_1985/DTEEC_045994_1985_046060_1985_U01.tif",
      "fetchedAt": "2026-11-14T17:15:29+00:00",
      "sampling": {
        "frame": "azimutal equidistante local (fila 0 = norte, columna 0 = oeste)",
        "preGrid": "129×129 a 18.75 m, promedio de área + bilineal",
        "resample": "terrain_metrics.bilinear_resample 129→65",
        "radiusMeters": 3396190,
        "elevationDatum": "altura relativa al radio/areoide de referencia del producto (m)"
      },
      "georeferencing": {
        "frame": "AEQD",
        "radiusMeters": 3396190,
        "source": "grid.sampling.frame/radiusMeters"
      },
      "notes": [
        "Centro en el sitio de aterrizaje Octavia E. Butler (18.4447°N, 77.4508°E); el frente del delta queda ~2 km al oeste, en el borde de la ventana.",
        "HiRISE DTM a 1 m promediado a celdas de 18.75 m antes de la rejilla de 37.5 m: la rugosidad métrica (rocas, megaripples) desaparece del índice geométrico.",
        "Elevación relativa al areoide/esfera de referencia de Marte del producto PDS (valores negativos ~-2.5 km son normales en Jezero).",
        "Térmica: Mars Climate Database (modelo, celda de varios km), no medición MEDA/Perseverance; queda como propuesta integrar series MEDA del PDS Atmospheres Node.",
        "Rugosidad: sin dato de radar equivalente; metrics.roughness = null."
      ],
      "provenance": [
        {
          "label": "MRO HiRISE DTM DTEEC_045994_1985_046060_1985_U01 (Univ. of Arizona / USGS, 1 m/px)",
          "url": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_045994_1985_ESP_046060_1985/DTEEC_045994_1985_046060_1985_U01.tif"
        },
        {
          "label": "Catálogo / página del producto",
          "url": "https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms/items/DTEEC_045994_1985_046060_1985_U01"
        },
        {
          "label": "Térmica: Mars Climate Database v6.2",
          "url": "http://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py"
        },
        {
          "label": "Imagen de contexto",
          "url": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_045994_1985_ESP_046060_1985/ESP_045994_1985_RED_C_01_ORTHO.tif"
        }
      ]
    },
    "georeference": {
      "latitude": 18.449130983959108,
      "longitude": 77.46214221567493,
      "kind": "model-projection-inverse",
      "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
      "reference": {
        "frame": "AEQD",
        "radiusMeters": 3396190,
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
      "Marte omite atmósfera y viento en este tramo idealizado; no reproduce entrada, paracaídas ni EDL marciano."
    ]
  }
}
```
Historial: 74 muestras; eventos: 5. UTC y SIM descenso independientes del rover ×20.
- Ejecución reproducible del motor idealizado a 2 muestras/s SIM; fechas de evidencia controladas, no observación UTC de vuelo.
- Datos DEM reales versionados; la ejecución es virtual. No certifica el terreno.
- SIM descenso y UTC controlada separados del SIM rover ×20; no se fabrican muestras rover.
