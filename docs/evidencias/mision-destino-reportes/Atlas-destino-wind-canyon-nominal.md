# Dossier local · Cañón de erosión eólica

Contrato 1.0.0 · Auditor 1.0.0 · 2026-11-14T22:00:13.000Z

Wadi Rum · Jordania ↔ Valles Marineris · pared norte de Coprates Chasma

Auditoría exploratoria local; no certifica similitud física, seguridad ni aptitud de misión. Parámetros de calculadora son hipótesis del usuario.

## Strength vs. Breakdown

| Parámetro | Estado | Fortaleza | Ruptura | Acción |
| --- | --- | --- | --- | --- |
| Escala regional | valid | Misma ventana y muestreo: comparación regional reproducible. | La rejilla no resuelve contactos rueda/suelo, rocas ni cavidades; resolución nativa e interpolación limitan el ensayo. | Medir a la escala del instrumento antes de diseñar el ensayo. |
| Relieve · Strength vs. Breakdown | partial | Índice geométrico 83/100; pendientes, desnivel y TRI documentados. | El índice no mide similitud física; rugosidad radar dB y CPR no son intercambiables. | Usar componentes y advertencias para elegir tareas, sin umbral universal de validez. |
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

- scale / earth.grid: {"gridSize":65,"spacingMeters":37.5,"extentMeters":2400,"nativeResolutionMeters":30,"dataset":"Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)","source":"https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30","fetchedAt":"2026-11-15T02:07:26+00:00","license":"https://spacedata.copernicus.eu/documents/20126/0/CSCDA\_ESA\_Mission-specific+Annex.pdf","credit":"© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"}
- scale / target.grid: {"gridSize":65,"spacingMeters":37.5,"extentMeters":2400,"nativeResolutionMeters":20.03,"dataset":"MRO CTX DTM D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W (USGS Astrogeology, ASP, 20 m/px, controlado a MOLA)","source":"https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W/D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W\_dtm.tif","fetchedAt":"2026-11-14T17:15:29+00:00","license":null,"credit":null}
- geometry / geometry: {"index":83,"comparable":true,"components":\[{"key":"slopeP50Deg","label":"Pendiente mediana (p50)","unit":"°","earth":22.69,"target":23,"score":98.7,"weight":0.3333333333333333},{"key":"slopeP90Deg","label":"Pendiente p90","unit":"°","earth":46.55,"target":31.31,"score":67.3,"weight":0.2777777777777778},{"key":"reliefP95P5M","label":"Desnivel p95–p5","unit":"m","earth":645.24,"target":803.76,"score":80.3,"weight":0.22222222222222224},{"key":"triMeanM","label":"TRI medio","unit":"m","earth":14.66,"target":11.65,"score":79.5,"weight":0.16666666666666666}\],"caveats":\["Índice de similitud geométrica, no planetaria: la geometría del relieve no reproduce gravedad, regolito, iluminación ni química.","Rugosidad radar no disponible en ambos sitios: no entra en el índice.","Pesos editoriales del prototipo, no calibrados frente a misiones reales."\]}
- gravity / earth.gravity: {"value":9.81,"unit":"m/s²","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html","observedAt":null}
- gravity / target.gravity: {"value":3.71,"unit":"m/s²","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html","observedAt":null}
- atmosphere / target.pressure: {"value":636,"unit":"Pa","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html","observedAt":null}
- atmosphere / reference.atmosphere: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html"
- pressure / earth.pressure: {"value":null,"unit":"Pa","kind":"unknown","source":null,"observedAt":null}
- pressure / target.pressure: {"value":636,"unit":"Pa","kind":"reference","source":"https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html","observedAt":null}
- temperature / earth.airTemperature: {"value":null,"unit":"K","kind":"unknown","source":null,"observedAt":null}
- temperature / earth.surfaceTemperature: {"minK":null,"maxK":null,"meanK":null,"kind":"unknown","source":null}
- temperature / target.surfaceTemperature: {"minK":183,"maxK":299.9,"meanK":226.1,"kind":"model","source":"Mars Climate Database v6.2 (LMD/OU/IAA/ESA/CNES), escenario climatológico, temperatura de superficie en -12.84°N 299.42°E; curve = Ls 0° (equinoccio de primavera boreal) por hora solar local marciana; min/max/mean sobre Ls 0/90/180/270 × 24 h. http://www-mars.lmd.jussieu.fr/mcd\_python/cgi-bin/mcdcgi.py"}
- heat-transfer / reference.thermal: "https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/"
- radiation / earth.ionizingDoseRate: {"value":null,"unit":"Sv/s","kind":"unknown","source":null,"observedAt":null}
- radiation / target.ionizingDoseRate: {"value":null,"unit":"Sv/s","kind":"unknown","source":null,"observedAt":null}
- radiation / reference.radiation: "https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/"

### earth

Telemetría: desconocido
- UNESCO · Wadi Rum Protected Area (sitio del Patrimonio Mundial 1377): https://whc.unesco.org/en/list/1377/
- Copernicus DEM GLO-30 · tesela Copernicus\_DSM\_COG\_10\_N29\_00\_E035\_00\_DEM (Planetary Computer): https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus\_DSM\_COG\_10\_N29\_00\_E035\_00\_DEM
- Sentinel-2 L2A · S2A\_MSIL2A\_20261112T082111\_R121\_T36RYT\_20261112T120009 (2026-11-12): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2A\_MSIL2A\_20261112T082111\_R121\_T36RYT\_20261112T120009
- Sentinel-1 RTC · S1C\_IW\_GRDH\_1SDV\_20261114T153919\_20261114T153944\_010335\_014A49\_rtc (2026-11-14): https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C\_IW\_GRDH\_1SDV\_20261114T153919\_20261114T153944\_010335\_014A49\_rtc
- Sitio solo de escenario (no está en data.js), dentro del área protegida de Wadi Rum.
- Centro de la ventana elegido con scripts/analog\_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (29.560 N, 35.420 E, valle ~1 km al sur de la aldea de Rum), la de mayor índice geométrico frente a «Valles Marineris». Es una elección reproducible del equipo, no un punto de ensayo publicado. La ventana cruza el flanco del macizo de arenisca de Jebel Rum y el valle de arena: talud empinado como la pared de Coprates.
- Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain\_metrics.bilinear\_resample. Fila 0 = norte, columna 0 = oeste.
- Métricas calculadas con scripts/terrain\_metrics.compute\_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).
- thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).
- La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria.

### target

Telemetría: desconocido
- MRO CTX DTM D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W (USGS Astrogeology, ASP, 20 m/px, controlado a MOLA): https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W/D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W\_dtm.tif
- Catálogo / página del producto: https://stac.astrogeology.usgs.gov/api/collections/mro\_ctx\_controlled\_usgs\_dtms/items/D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W
- Térmica: Mars Climate Database v6.2: http://www-mars.lmd.jussieu.fr/mcd\_python/cgi-bin/mcdcgi.py
- Imagen de contexto: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W/D21\_035410\_1669\_XN\_13S060W\_\_D20\_034988\_1669\_XN\_13S060W\_orthoimage.tif
- Ventana sobre la pared norte de Coprates Chasma (Valles Marineris) en la franja del DTM CTX; el centro (-12.84°, -60.58° = 299.42°E) se eligió con choose\_valles\_center(): entre ventanas completas con desnivel \< 1500 m a lo largo de la pared, la de mayor pendiente p50. Es talud de pared con espolones y cárcavas (no el fondo plano), el caso extremo de navegación en pendiente.
- Elevación relativa al areoide MOLA (GEOID=mola en el producto).
- Térmica: Mars Climate Database (modelo); THEMIS no se usó porque los mosaicos THEMIS IR de USGS son de brillo/inercia térmica y no curvas de temperatura absolutas por hora.
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

Misión: evidencia-destino-wind-canyon-nominal. Escenario: wind-canyon. Fase: exploration.
Inicio UTC: 2026-11-14T22:00:00.000Z. Fin UTC: 2026-11-14T22:00:13.000Z.
Misión centrada en destino lunar/marciano: solo desciende el objetivo en target-first. Tierra es análogo de ensayo/control simulado, sin segundo aterrizaje ni telemetría de hardware; paired-legacy conserva dos vuelos virtuales explícitos. El espejo aplica contactoTarget + desplazamiento desde origenEarth; no hay homología geográfica. Clima terrestre y herramientas propuestas no son lecturas planetarias. DEM regional: no resuelve patas, rocas ni cavidades. Contacto del modelo no certifica seguridad; sin TRN/visión NASA implementada, entrada ni paracaídas. UTC, SIM descenso (s) y SIM rover ×20 son relojes separados; exageración visual ×2 no cambia física SI.

Propósito: elegir zona y combustible del destino; Tierra prepara y ensaya el control del rover. El contacto objetivo gobierna despliegue y exploración. No se solicita un segundo aterrizaje.
Espejo disponible: Sí. Movimiento objetivo = contactoTarget + (roverEarth − origenEarth).
Orígenes propios (sin homología geográfica):
```json
{
  "earth": {
    "x": 0,
    "z": 0,
    "elevationM": 1431.2,
    "gridId": "wadi-rum",
    "georeference": null,
    "role": "analogue-test-origin",
    "kind": "local-dem-center",
    "reason": "Centro del DEM terrestre sobre superficie: referencia local automática para el ensayo de conducción, sin homología científica automática ni aterrizaje terrestre. Georreferencia no disponible sin función de proyección compartida."
  },
  "target": {
    "x": -937.2445967110215,
    "z": -487.6663216862729,
    "elevationM": -3596.23710028287,
    "gridId": "valles-marineris",
    "georeference": {
      "latitude": -12.831772277010485,
      "longitude": -60.59621687785193,
      "kind": "model-projection-inverse",
      "method": "Inversa AEQD esférica con radio del muestreo del DEM.",
      "reference": {
        "frame": "AEQD",
        "radiusMeters": 3396190,
        "source": "grid.sampling.frame/radiusMeters"
      },
      "limitation": "Coordenadas derivadas del marco del DEM; precisión física limitada por el producto y su remuestreo."
    },
    "role": "target-contact",
    "kind": "engine-contact",
    "reason": "Origen obtenido del contacto nominal real del motor SI."
  }
}
```
### Objetivo principal
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
    "gridId": "valles-marineris",
    "body": "mars",
    "profileId": "atlas-final-mars-v1",
    "grid": {
      "id": "valles-marineris",
      "body": "mars",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 20.03,
      "center": [
        -12.84,
        -60.58
      ],
      "dataset": "MRO CTX DTM D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W (USGS Astrogeology, ASP, 20 m/px, controlado a MOLA)",
      "source": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W_dtm.tif",
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
        "Ventana sobre la pared norte de Coprates Chasma (Valles Marineris) en la franja del DTM CTX; el centro (-12.84°, -60.58° = 299.42°E) se eligió con choose_valles_center(): entre ventanas completas con desnivel < 1500 m a lo largo de la pared, la de mayor pendiente p50. Es talud de pared con espolones y cárcavas (no el fondo plano), el caso extremo de navegación en pendiente.",
        "Elevación relativa al areoide MOLA (GEOID=mola en el producto).",
        "Térmica: Mars Climate Database (modelo); THEMIS no se usó porque los mosaicos THEMIS IR de USGS son de brillo/inercia térmica y no curvas de temperatura absolutas por hora.",
        "Rugosidad: sin dato de radar equivalente; metrics.roughness = null."
      ],
      "provenance": [
        {
          "label": "MRO CTX DTM D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W (USGS Astrogeology, ASP, 20 m/px, controlado a MOLA)",
          "url": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W_dtm.tif"
        },
        {
          "label": "Catálogo / página del producto",
          "url": "https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms/items/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W"
        },
        {
          "label": "Térmica: Mars Climate Database v6.2",
          "url": "http://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py"
        },
        {
          "label": "Imagen de contexto",
          "url": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W_orthoimage.tif"
        }
      ]
    },
    "sciencePoint": {
      "x": 0,
      "z": 0
    },
    "zones": [
      {
        "id": "valles-marineris-r19-c7",
        "gridId": "valles-marineris",
        "x": -937.5,
        "z": -487.5,
        "elevationM": -3596.26,
        "slopeDeg": 7.021362972432251,
        "maxSlopeDeg": 7.551958788422474,
        "reliefM": 24.659999999999854,
        "scienceDistanceM": 1056.6752102704029,
        "status": "candidate",
        "eligible": true,
        "score": 51,
        "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 20.03,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -12.83177508268689,
          "longitude": -60.59622129720367,
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
        "id": "valles-marineris-r27-c3",
        "gridId": "valles-marineris",
        "x": -1087.5,
        "z": -187.5,
        "elevationM": -3633.3,
        "slopeDeg": 9.717814797033522,
        "maxSlopeDeg": 12.249269908714153,
        "reliefM": 31.639999999999873,
        "scienceDistanceM": 1103.5454227171622,
        "status": "caution",
        "eligible": true,
        "score": 34.9,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 20.03,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -12.836836092127447,
          "longitude": -60.59881708348678,
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
        "id": "valles-marineris-r3-c7",
        "gridId": "valles-marineris",
        "x": -937.5,
        "z": -1087.5,
        "elevationM": -3516.1,
        "slopeDeg": 9.978235905371609,
        "maxSlopeDeg": 11.766915299837422,
        "reliefM": 37.870000000000346,
        "scienceDistanceM": 1435.8142289307484,
        "status": "caution",
        "eligible": true,
        "score": 29.2,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 20.03,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -12.821652719920582,
          "longitude": -60.59622064449775,
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
        "id": "valles-marineris-r11-c9",
        "gridId": "valles-marineris",
        "x": -862.5,
        "z": -787.5,
        "elevationM": -3568.04,
        "slopeDeg": 10.980506978893825,
        "maxSlopeDeg": 12.424672410715038,
        "reliefM": 38.149999999999636,
        "scienceDistanceM": 1167.9308626798077,
        "status": "caution",
        "eligible": true,
        "score": 25.7,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 20.03,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -12.82671397769985,
          "longitude": -60.59492329314082,
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
        "id": "valles-marineris-r39-c3",
        "gridId": "valles-marineris",
        "x": -1087.5,
        "z": 262.5,
        "elevationM": -3667.67,
        "slopeDeg": 11.66845323780932,
        "maxSlopeDeg": 16.07503272967426,
        "reliefM": 49.80000000000018,
        "scienceDistanceM": 1118.7325417632221,
        "status": "caution",
        "eligible": true,
        "score": 16.7,
        "reason": "Cautela regional: cerca de límites propuestos; obstáculos locales desconocidos.",
        "scaleMeters": 225,
        "neighborhoodRadiusM": 112.5,
        "spacingMeters": 37.5,
        "nativeResolutionMeters": 20.03,
        "coverage": 1,
        "sciencePoint": {
          "x": 0,
          "z": 0
        },
        "georeference": {
          "latitude": -12.844427864163642,
          "longitude": -60.598817651807565,
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
    "selectedId": "valles-marineris-r19-c7",
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
    "simSeconds": 36.058522960543684,
    "x": -937.2445967110215,
    "z": -487.6663216862729,
    "yM": -3596.23710028287,
    "altitudeM": 0,
    "groundElevationM": -3596.23710028287,
    "verticalSpeedMs": -0.8524069148787033,
    "horizontalSpeedMs": 0.0567404469463671,
    "vxMs": -0.0475473041193957,
    "vyMs": -0.8524069148787033,
    "vzMs": 0.03096340082502561,
    "pitchDeg": -0.0866566645558333,
    "rollDeg": -0.1330692219345315,
    "thrustN": 0,
    "throttle": 0,
    "propellantKg": 209.18769871132977,
    "massKg": 1059.1876987113299,
    "gravityMs2": 3.71,
    "weightN": 3929.5863622190336,
    "positionErrorM": 0.30478474920132265,
    "target": {
      "id": "valles-marineris-r19-c7",
      "gridId": "valles-marineris",
      "x": -937.5,
      "z": -487.5,
      "elevationM": -3596.26,
      "slopeDeg": 7.021362972432251,
      "maxSlopeDeg": 7.551958788422474,
      "reliefM": 24.659999999999854,
      "scienceDistanceM": 1056.6752102704029,
      "status": "candidate",
      "eligible": true,
      "score": 51,
      "reason": "Candidato regional dentro de límites propuestos; obstáculos locales desconocidos.",
      "scaleMeters": 225,
      "neighborhoodRadiusM": 112.5,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 20.03,
      "coverage": 1,
      "sciencePoint": {
        "x": 0,
        "z": 0
      },
      "georeference": {
        "latitude": -12.83177508268689,
        "longitude": -60.59622129720367,
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
      "verticalSpeedMs": 0.848143491452357,
      "horizontalSpeedMs": 0.0567404469463671,
      "tiltDeg": 0.15879780014560066,
      "positionErrorM": 0.30478474920132265,
      "slopeDeg": 6.4343744392238165,
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
      "id": "valles-marineris",
      "body": "mars",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 20.03,
      "center": [
        -12.84,
        -60.58
      ],
      "dataset": "MRO CTX DTM D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W (USGS Astrogeology, ASP, 20 m/px, controlado a MOLA)",
      "source": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W_dtm.tif",
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
        "Ventana sobre la pared norte de Coprates Chasma (Valles Marineris) en la franja del DTM CTX; el centro (-12.84°, -60.58° = 299.42°E) se eligió con choose_valles_center(): entre ventanas completas con desnivel < 1500 m a lo largo de la pared, la de mayor pendiente p50. Es talud de pared con espolones y cárcavas (no el fondo plano), el caso extremo de navegación en pendiente.",
        "Elevación relativa al areoide MOLA (GEOID=mola en el producto).",
        "Térmica: Mars Climate Database (modelo); THEMIS no se usó porque los mosaicos THEMIS IR de USGS son de brillo/inercia térmica y no curvas de temperatura absolutas por hora.",
        "Rugosidad: sin dato de radar equivalente; metrics.roughness = null."
      ],
      "provenance": [
        {
          "label": "MRO CTX DTM D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W (USGS Astrogeology, ASP, 20 m/px, controlado a MOLA)",
          "url": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W_dtm.tif"
        },
        {
          "label": "Catálogo / página del producto",
          "url": "https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms/items/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W"
        },
        {
          "label": "Térmica: Mars Climate Database v6.2",
          "url": "http://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py"
        },
        {
          "label": "Imagen de contexto",
          "url": "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W_orthoimage.tif"
        }
      ]
    },
    "georeference": {
      "latitude": -12.831772277010485,
      "longitude": -60.59621687785193,
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
### Tierra: análogo / referencia
No aplica: sin descenso terrestre. Perfil/plan Tierra son referencia; el origen de ensayo en superficie no es contacto de nave.
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
    "gridId": "wadi-rum",
    "body": "earth",
    "profileId": "atlas-final-earth-v1",
    "grid": {
      "id": "wadi-rum",
      "body": "earth",
      "gridSize": 65,
      "spacingMeters": 37.5,
      "nativeResolutionMeters": 30,
      "center": [
        29.56609,
        35.40684
      ],
      "dataset": "Copernicus DEM GLO-30 (Planetary Computer cop-dem-glo-30)",
      "source": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30",
      "fetchedAt": "2026-11-15T02:07:26+00:00",
      "sampling": null,
      "georeferencing": {
        "frame": "AEQD",
        "ellipsoid": "WGS84",
        "source": "scripts/fetch-scenarios-earth.py:site_crs + grid.notes"
      },
      "notes": [
        "Sitio solo de escenario (no está en data.js), dentro del área protegida de Wadi Rum.",
        "Centro de la ventana elegido con scripts/analog_match.py: entre las ventanas de 2400 m a ≤ 5 km del punto de referencia (29.560 N, 35.420 E, valle ~1 km al sur de la aldea de Rum), la de mayor índice geométrico frente a «Valles Marineris». Es una elección reproducible del equipo, no un punto de ensayo publicado. La ventana cruza el flanco del macizo de arenisca de Jebel Rum y el valle de arena: talud empinado como la pared de Coprates.",
        "Alturas Copernicus DEM GLO-30 (modelo digital de superficie, alturas ortométricas EGM2008) leídas por ventana del COG, reproyectadas (bilineal) a una rejilla acimutal equidistante centrada en el sitio de 81×81 nodos a 30 m y remuestreadas a 65×65 a 37.5 m con terrain_metrics.bilinear_resample. Fila 0 = norte, columna 0 = oeste.",
        "Métricas calculadas con scripts/terrain_metrics.compute_metrics sobre esta rejilla (elevaciones redondeadas a 0.1 m).",
        "thermal=null: la telemetría meteorológica en vivo de la Tierra la aporta el backend (/api/telemetry).",
        "La rugosidad radar (dB) es un indicador de retrodispersión, no una medida de similitud planetaria."
      ],
      "provenance": [
        {
          "label": "UNESCO · Wadi Rum Protected Area (sitio del Patrimonio Mundial 1377)",
          "url": "https://whc.unesco.org/en/list/1377/"
        },
        {
          "label": "Copernicus DEM GLO-30 · tesela Copernicus_DSM_COG_10_N29_00_E035_00_DEM (Planetary Computer)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30/items/Copernicus_DSM_COG_10_N29_00_E035_00_DEM"
        },
        {
          "label": "Sentinel-2 L2A · S2A_MSIL2A_20261112T082111_R121_T36RYT_20261112T120009 (2026-11-12)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2A_MSIL2A_20261112T082111_R121_T36RYT_20261112T120009"
        },
        {
          "label": "Sentinel-1 RTC · S1C_IW_GRDH_1SDV_20261114T153919_20261114T153944_010335_014A49_rtc (2026-11-14)",
          "url": "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/S1C_IW_GRDH_1SDV_20261114T153919_20261114T153944_010335_014A49_rtc"
        }
      ]
    },
    "sciencePoint": {
      "x": 0,
      "z": 0
    },
    "zones": [
      {
        "id": "wadi-rum-r3-c59",
        "gridId": "wadi-rum",
        "x": 1012.5,
        "z": -1087.5,
        "elevationM": 956,
        "slopeDeg": 1.5947493818993816,
        "maxSlopeDeg": 2.752319278629289,
        "reliefM": 5.399999999999977,
        "scienceDistanceM": 1485.870956711921,
        "status": "candidate",
        "eligible": true,
        "score": 84,
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
          "latitude": 29.575900564668288,
          "longitude": 35.41728957476482,
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
        "id": "wadi-rum-r61-c47",
        "gridId": "wadi-rum",
        "x": 562.5,
        "z": 1087.5,
        "elevationM": 979.9,
        "slopeDeg": 1.9319092725050875,
        "maxSlopeDeg": 2.2906100426385296,
        "reliefM": 7.2999999999999545,
        "scienceDistanceM": 1224.362078798588,
        "status": "candidate",
        "eligible": true,
        "score": 82.7,
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
          "latitude": 29.556278882965675,
          "longitude": 35.41264419729214,
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
        "id": "wadi-rum-r59-c57",
        "gridId": "wadi-rum",
        "x": 937.5,
        "z": 1012.5,
        "elevationM": 971.1,
        "slopeDeg": 2.054681106878793,
        "maxSlopeDeg": 2.9165033103128293,
        "reliefM": 6.899999999999977,
        "scienceDistanceM": 1379.8777119730573,
        "status": "candidate",
        "eligible": true,
        "score": 81.1,
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
          "latitude": 29.5569552779902,
          "longitude": 35.41651372659919,
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
        "id": "wadi-rum-r51-c61",
        "gridId": "wadi-rum",
        "x": 1087.5,
        "z": 712.5,
        "elevationM": 963,
        "slopeDeg": 2.1704972108642195,
        "maxSlopeDeg": 2.595631540925608,
        "reliefM": 10,
        "scienceDistanceM": 1300.1201867519787,
        "status": "candidate",
        "eligible": true,
        "score": 79.5,
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
          "latitude": 29.55966163745195,
          "longitude": 35.418061821961146,
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
        "id": "wadi-rum-r41-c61",
        "gridId": "wadi-rum",
        "x": 1087.5,
        "z": 337.5,
        "elevationM": 955.3,
        "slopeDeg": 2.4856599960691144,
        "maxSlopeDeg": 3.1132237251069186,
        "reliefM": 8.600000000000023,
        "scienceDistanceM": 1138.6669838016733,
        "status": "candidate",
        "eligible": true,
        "score": 79.3,
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
          "latitude": 29.563044737408912,
          "longitude": 35.4180621959008,
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
    "selectedId": "wadi-rum-r3-c59",
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
  "run": null
}
```
Historial: 27 muestras; eventos: 8. UTC y SIM descenso independientes del rover ×20.
- Diseño propuesto para comparación virtual; masas, motor, combustible y tolerancias no son requisitos de una misión real.
- Solo descenso propulsado final: sin órbita, entrada, paracaídas ni EDL completo.
- El DEM solo permite evaluación regional; no resuelve patas, rocas, polvo ni geometría de un pozo o cueva.
- Contacto dentro de tolerancias del modelo no certifica seguridad del terreno.
- La comparación usa configuraciones adaptadas por cuerpo (combustible y empuje distintos); no aísla la gravedad como única variable.
- Tierra es una comparación virtual sin aerodinámica, no un ensayo físico terrestre.
- Marte omite atmósfera y viento en este tramo idealizado; no reproduce entrada, paracaídas ni EDL marciano.
- Heurística regional determinista, sin probabilidad de éxito ni zona segura certificada.
- Navegación idealizada con posición exacta; no implementa visión, TRN, SPLICE ni detección de obstáculos.
- Coordenadas locales x este, z sur, y altura DEM, en metros SI; exageración gráfica ×2 excluida de la física.
- Punto científico y contacto son distintos; la separación nominal no representa el contorno de un pozo.
- Evaluación regional: DEM de 37,5 m no resuelve patas, rocas ni la geometría del pozo.
- Tierra es origen de ensayo de conducción sobre superficie; su perfil y plan son referencias de análisis, sin vuelo ni aterrizaje terrestre. El espejo relativo no implica homología científica automática.
- Relieve visual ×2; dinámica SI y altitud AGL sin exageración.
