# Perfiles base de misión M2

Versión **1.0.0**, revisión de diseño **2026-11-14**. Son propuestas explícitas de equipo y ensayo para Atlas: **no son mediciones, fichas NASA, calibraciones completadas ni umbrales de seguridad validados**. La fecha identifica esta versión estática; no es una fecha de observación. No se utilizaron fuentes NASA para atribuir propiedades a instrumentos inexistentes.

`mission-profiles.mjs` ofrece `BASE_PROFILE_VERSION`, `getMissionBaseProfile(scenarioOrId)` y `validateMissionBaseProfile(profile)`. El selector acepta el ID real o un objeto con `.id`, devuelve una copia aislada y lanza `RangeError` para cualquier misión no soportada. No sustituye una misión por otra. El validador devuelve `{valid, errors}` y comprueba procedencia, completitud, unidades, rangos, presupuestos y masa compartida.

## Misiones y métodos propuestos

| ID de escenario / destino | Tarea y método | Herramienta de muestra: masa / potencia / diámetro / carrera | Empuje / par de banco |
| --- | --- | --- | --- |
| `lava-tube` / Marius Hills | Inspección de bloques basálticos e iluminación activa en banco terrestre; apoyo externo mediante cabrestante | Taladro: 18 kg / 100 W / 0.020 m / 0.080 m | 120 N / 8 N·m |
| `polar-shadow` / Shackleton | Extractor de testigo frío; cápsula de equipo protegida frente a pared fría en cámara de vacío técnico | Extractor: 24 kg / 140 W / 0.025 m / 0.120 m | 90 N / 6 N·m |
| `hyperarid-salt` / Jezero | Barrena y cámara macro para simulante salino; recipientes pasivos externos para separar muestras | Barrena: 14 kg / 80 W / 0.030 m / 0.100 m | 70 N / 5 N·m |
| `wind-canyon` / Coprates, Valles Marineris | Navegación estereoscópica, recolección de arena y canal eólico con rampa | Recolector: 8 kg / 35 W / 0.060 m / 0.030 m | 30 N / 2 N·m |

El último escenario mantiene el ID de destino existente `valles-marineris`; Coprates es el foco descriptivo de este plan. Empuje y par se eligen como consignas de actuadores independientes para comparar mecanismos; **no se calculan como masa por gravedad ni describen resistencia medida del material**. Deben verificarse con ensayos de fuerza, par, atasco y calidad de muestra.

## Masa, potencia y geometría

La masa global se lee exclusivamente de [`ROVER_CONFIG`](../../rover-config.mjs): **350 kg** del prototipo didáctico Atlas. No corresponde a Perseverance, Scarecrow ni a una malla NASA. `ROVER_CONFIG` no se modifica: los nuevos perfiles no sustituyen sus campos desconocidos por observaciones.

Cada herramienta tiene `quantity`, `massScope`, `status: proposed-design`, `connected: false` y parámetros con `value`, `unit`, `kind`, `source` y `rationale`. Los valores de masa y potencia son **por unidad**; se multiplican por `quantity` al estimar un subtotal. `source: docs/modules/perfiles-base-m2.md` significa propuesta documentada aquí, no una cita NASA. Los motivos de cada parámetro en el módulo forman parte del contrato exportable.

| `massScope` | Interpretación |
| --- | --- |
| `rover-total` | Único total de 350 kg, incluye los componentes siguientes |
| `included-in-rover` | Asignación dentro de los 350 kg; no se vuelve a sumar al total |
| `external-kit` | Kit de soporte externo con suministro separado; no carga física del rover |
| `test-equipment` | Instalación de laboratorio con masa y suministro propios |

| Misión | Rueda: radio / ancho / masa por unidad | Cámaras: cantidad × masa / W por unidad / resolución objetivo | Control térmico: kg / W | Componentes incluidos / reserva de masa | Presupuesto rover / componentes eléctricos |
| --- | --- | --- | --- | --- | --- |
| Marius | 0.25 m / 0.16 m / 4.5 kg | 2 × 1.2 kg / 18 W / 0.002 m | 16 / 150 | 64.2 / 285.8 kg | 650 / 498 W |
| Shackleton | 0.27 m / 0.20 m / 5.0 kg | 2 × 1.5 kg / 24 W / 0.003 m | 32 / 600 | 89.8 / 260.2 kg | 1200 / 1030 W |
| Jezero | 0.25 m / 0.18 m / 4.5 kg | 1 × 1.8 kg / 15 W / 0.0001 m | 20 / 180 | 63.6 / 286.4 kg | 600 / 457 W |
| Coprates | 0.30 m / 0.22 m / 5.5 kg | 2 × 1.4 kg / 20 W / 0.010 m | 18 / 220 | 62.6 / 287.4 kg | 750 / 597 W |

Los subtotales incluyen seis conjuntos rueda/accionamiento, muestreador, cámaras equipadas, control térmico y dosímetro. La reserva `350 − Σ(quantity × massKg)` queda para estructura, energía, cableado y otros subsistemas todavía sin desglose; no equivale a capacidad de carga demostrada. El presupuesto eléctrico tiene margen sobre las cargas nominales propuestas, sin estimación de autonomía. La envolvente inicial del rover es 1.5 × 1.2 m; es una decisión de integración por verificar.

La masa soportada nominal por rueda es `350/6 = 58.333… kg`, de tipo `derived-design`: reparto igualitario sobre seis apoyos en **suelo horizontal**. No es masa propia de rueda, peso en newtons, distribución medida ni reparto válido en pendiente. La masa de cada conjunto rueda se declara aparte.

Las cámaras tienen campos angulares de 1.2, 1.4, 0.7 y 1.6 rad respectivamente. La resolución espacial es un objetivo en el plano de ensayo cuya distancia deberá fijarse antes de seleccionar óptica y sensor; no se ofrece una prestación comercial validada. La mayor resolución de Jezero responde a granos y sales; el par de Coprates prioriza navegación.

## Térmica base de ensayo

`thermal` describe **la superficie del equipo protegido frente a una pared de banco**, nunca el aire meteorológico ni una superficie observada por Diviner. Cada cantidad lleva procedencia y supuesto. Los coeficientes `h` se suponen para cerrar un modelo sencillo: requieren identificación experimental y no se deducen de colores NASA, velocidad del viento o una atmósfera planetaria.

| Misión | Área m² | Superficie equipo K | Pared de banco K | h W/m²/K | ε (1) | Contexto |
| --- | --- | --- | --- | --- | --- | --- |
| Marius | 0.8 | 293.15 | 283.15 | 6 | 0.85 | Cerramiento terrestre moderadamente frío, convección nominal |
| Shackleton | 1.0 | 273.15 | 150 | 0 | 0.80 | Cámara fría idealizada con convección despreciada |
| Jezero | 0.6 | 303.15 | 293.15 | 8 | 0.90 | Equipo calentado en banco de aire terrestre |
| Coprates | 0.9 | 293.15 | 283.15 | 12 | 0.85 | Canal de aire terrestre, convección forzada supuesta |

El área representa una cápsula o conjunto térmico efectivo y no la superficie total del rover. Las emisividades son hipótesis de recubrimiento gris para comparar diseños. El modelo estacionario asume factor de vista unitario:

- `Qconv = h × A × (Ts − Tpared)`.
- `Qrad = ε × σ × A × (Ts⁴ − Tpared⁴)`; usar la constante de Stefan–Boltzmann del cálculo térmico existente.

Un valor positivo significa pérdida de calor desde la superficie del equipo en esta convención. Se excluyen sol, conducción por fijaciones, transitorios, acumulación de polvo, gas residual y generación interna. Esta base permite un cálculo nominal reproducible; no demuestra balance energético ni suficiencia del control térmico. El reporte debe mantener separados **base de ensayo** y **estado actual**, que puede seguir incompleto.

En Shackleton, **150 K es consigna de pared propuesta**, no temperatura medida del cráter ni del extractor. La cápsula se mantiene a 273.15 K; el objetivo de operación de sus componentes es 253.15–303.15 K. La instalación propone **1 Pa de presión absoluta**, sin prometer vacío físico de 0 Pa alcanzable. `h=0` es una idealización del cálculo que omite gas residual y pérdidas por soportes. La trampa fría externa trabaja en la zona de laboratorio; sus límites no habilitan colocar todo el kit dentro de la cámara. Tampoco se demuestra supervivencia a temperaturas criogénicas lunares.

## Equipo de laboratorio y soporte externo

| Misión | Banco: kg / W / longitud × ancho m / presión absoluta Pa | Kit externo: kg / W / capacidad o dimensión |
| --- | --- | --- |
| Marius | Basalto y cerramiento: 120 / 1200 / 2.4 × 1.6 / 101325 | Cabrestante: 25 / 250 / cable 20 m |
| Shackleton | Cámara fría y vacío: 800 / 5000 / 2.5 × 2.0 / 1 | Trampa fría y recipiente: 12 / 120 / muestra 0.5 kg |
| Jezero | Polvo y sales: 180 / 1800 / 2.2 × 1.8 / 101325 | Recipientes pasivos: 3 / No aplica: sin alimentación / muestra 1 kg |
| Coprates | Canal y rampa: 600 / 4000 / 4.0 × 2.0 / 101325 | Mástil anemométrico: 2 / 4 / altura 1 m |

Estas masas dimensionan preliminarmente la instalación y su alimentación, sin medición ni selección de fabricante. 101325 Pa es una consigna de banco propuesta, **no la presión actual de Lanzarote, Atacama o Wadi Rum**. El canal de Coprates propone 12 m/s y rampa de 0.17 rad (aproximadamente 10°): entradas de ensayo terrestre, sin afirmar umbral de saltación, tracción o vuelco marciano.

Los rangos de equipo protegido son Marius 263.15–313.15 K, Shackleton 253.15–303.15 K, Jezero 273.15–323.15 K y Coprates 263.15–323.15 K. Son objetivos para selección y verificación de componentes. Los bancos cubren esos extremos salvo que la pared fría de la cámara de Shackleton baja hasta 150 K; los kits externos permanecen en zona de laboratorio a 273.15–313.15 K.

El dosímetro tiene un presupuesto propuesto de 0.8 kg y 2 W y un **rango instrumental objetivo** de `1e-9` a `1e-4 Gy/s`, pendiente de selección, calibración y verificación de ruido y saturación. Esto no declara que un sensor existente alcance ese rango ni asigna dosis al ambiente. `environmentalDoseRateGyS` lleva `kind: not-applicable`, `value: 'No aplica: …'` y unidad `No aplica`, con la razón de ausencia de medición/fuente; no se convierte dosis absorbida en dosis equivalente ni riesgo biológico.

## Validación y límites de uso

Las pruebas contrastan los cuatro IDs con `assets/data/scenarios.json`, la relación con la configuración compartida de 350 kg, presupuestos por cantidad, diferencias de tarea, unidades y procedencia, aislamiento de copias y rechazo de perfiles incompletos o corruptos. Los datos evitan valores nulos, vacíos, `NaN` y texto `null` recursivamente. Un dato no aplicable conserva estado y motivo; un instrumento desconectado conserva `connected: false` aunque tenga parámetros de diseño.

No hay acceso a reloj, red, sensores ni archivos de medición desde el módulo. No modifica auditorías actuales, calibraciones, meteorología o registros de misión. La existencia de una base propuesta no completa automáticamente una observación faltante y la validez del esquema no significa validación física del diseño.
