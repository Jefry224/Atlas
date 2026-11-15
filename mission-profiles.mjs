// Propuestas de diseño para planificar ensayos; no son mediciones ni fichas NASA.
import { ROVER_CONFIG } from './rover-config.mjs';

export const BASE_PROFILE_VERSION = '1.0.0';
const SOURCE = 'docs/perfiles-base-m2.md';
const DESIGN = 'prototype-design';
const KINDS = new Set([DESIGN, 'reference', 'derived-design', 'not-applicable']);
const SCOPES = new Set(['rover-total', 'included-in-rover', 'external-kit', 'test-equipment']);
const THERMAL_UNITS = { areaM2: 'm²', surfaceK: 'K', surroundingsK: 'K', hWm2K: 'W/m²/K', emissivity: '1' };
const UNITS = {
  massKg: 'kg', powerW: 'W', radiusM: 'm', widthM: 'm', lengthM: 'm', heightM: 'm',
  diameterM: 'm', depthM: 'm', operatingMinK: 'K', operatingMaxK: 'K',
  supportedMassKg: 'kg', thrustN: 'N', torqueNm: 'N·m', pressurePa: 'Pa',
  doseRateMinGyS: 'Gy/s', doseRateMaxGyS: 'Gy/s', environmentalDoseRateGyS: 'Gy/s',
  resolutionM: 'm', fieldOfViewRad: 'rad', windSetpointMs: 'm/s',
  slopeSetpointRad: 'rad', sampleCapacityKg: 'kg', heatSetpointK: 'K',
};
const TOOL_PARAMETERS = {
  rover: ['lengthM', 'widthM'],
  wheels: ['radiusM', 'widthM', 'supportedMassKg'],
  sampler: ['diameterM', 'depthM', 'thrustN', 'torqueNm'],
  cameras: ['resolutionM', 'fieldOfViewRad'],
  'thermal-control': ['heatSetpointK'],
  dosimeter: ['doseRateMinGyS', 'doseRateMaxGyS', 'environmentalDoseRateGyS'],
  'support-bench': ['lengthM', 'widthM', 'pressurePa'],
  'external-kit': [],
};
const p = (key, label, value, unit, rationale, kind = DESIGN) => ({ key, label, value, unit, kind, source: SOURCE, rationale });
const na = (key, label, reason) => p(key, label, `No aplica: ${reason}`, 'No aplica', reason, 'not-applicable');
const quantity = (value, unit, rationale) => ({ value, unit, kind: DESIGN, source: SOURCE, rationale });
const limits = (min, max, rationale) => [
  p('operatingMinK', 'Límite inferior de ensayo propuesto', min, 'K', rationale),
  p('operatingMaxK', 'Límite superior de ensayo propuesto', max, 'K', rationale),
];
const tool = (id, name, purpose, role, count, massScope, parameters) => ({
  id, name, purpose, role, quantity: count, massScope, status: 'proposed-design', connected: false, parameters,
});

// Todos los números siguientes son decisiones nominales de ingeniería para un futuro ensayo.
const SPECS = {
  'lava-tube': {
    title: 'Marius Hills · inspección basáltica',
    purpose: 'Preparar inspección de paredes basálticas, perforación somera y movilidad de baja velocidad en un análogo de tubo de lava.',
    sampler: { name: 'Taladro de inspección basáltica', mass: 18, power: 100, diameter: 0.02, depth: 0.08, thrust: 120, torque: 8, min: 263.15, max: 313.15 },
    wheel: { radius: 0.25, width: 0.16, mass: 4.5, power: 35 },
    camera: { name: 'Cámara de inspección con iluminación', count: 2, mass: 1.2, power: 18, resolution: 0.002, fov: 1.2 },
    thermal: { area: 0.8, surface: 293.15, surroundings: 283.15, h: 6, emissivity: 0.85, mass: 16, power: 150, min: 263.15, max: 313.15 },
    roverPower: 650,
    support: { name: 'Banco basáltico y cerramiento térmico', mass: 120, power: 1200, length: 2.4, width: 1.6, pressure: 101325, min: 263.15, max: 313.15,
      reason: 'Banco terrestre con bloques de basalto y aire controlado; presión de consigna, no presión medida en Lanzarote ni vacío lunar.' },
    kit: { name: 'Cabrestante de soporte de ensayo', mass: 25, power: 250, key: 'lengthM', label: 'Longitud de cable propuesta', value: 20, unit: 'm',
      purpose: 'Apoyo externo para recuperar el prototipo en el banco basáltico; no habilita descenso real a un tubo lunar.' },
    method: 'Banco terrestre con convección lineal y radiación gris a un cerramiento uniforme; no reproduce el vacío de Marius Hills.',
  },
  'polar-shadow': {
    title: 'Shackleton · ensayo de sombra y frío',
    purpose: 'Planificar extracción somera en simulante enfriado y comprobar una cápsula térmica instrumentada en cámara, sin afirmar supervivencia criogénica del rover.',
    sampler: { name: 'Extractor de testigo frío', mass: 24, power: 140, diameter: 0.025, depth: 0.12, thrust: 90, torque: 6, min: 253.15, max: 303.15 },
    wheel: { radius: 0.27, width: 0.2, mass: 5, power: 40 },
    camera: { name: 'Cámara de navegación en sombra con luz activa', count: 2, mass: 1.5, power: 24, resolution: 0.003, fov: 1.4 },
    thermal: { area: 1, surface: 273.15, surroundings: 150, h: 0, emissivity: 0.8, mass: 32, power: 600, min: 253.15, max: 303.15 },
    roverPower: 1200,
    support: { name: 'Cámara de ensayo térmico y vacío técnico', mass: 800, power: 5000, length: 2.5, width: 2, pressure: 1, min: 150, max: 303.15,
      reason: 'Consigna de vacío técnico de 1 Pa propuesta para cámara; h=0 idealiza el gas residual y exige validación experimental.' },
    kit: { name: 'Trampa fría y recipiente de testigos', mass: 12, power: 120, key: 'sampleCapacityKg', label: 'Capacidad de muestra propuesta', value: 0.5, unit: 'kg',
      purpose: 'Conservar muestras del banco frío fuera del rover; no representa detección de hielo en Shackleton.' },
    method: 'Cámara idealizada de radiación gris: cápsula a 273.15 K frente a pared a 150 K y h=0; ignora gas residual y conducción por fijaciones.',
  },
  'hyperarid-salt': {
    title: 'Jezero · muestreo de sales',
    purpose: 'Planificar extracción superficial y manejo separado de simulantes salinos, con inspección de granos y abrasión controlada.',
    sampler: { name: 'Barrena para simulante salino', mass: 14, power: 80, diameter: 0.03, depth: 0.1, thrust: 70, torque: 5, min: 273.15, max: 323.15 },
    wheel: { radius: 0.25, width: 0.18, mass: 4.5, power: 30 },
    camera: { name: 'Cámara macro de granos y sales', count: 1, mass: 1.8, power: 15, resolution: 0.0001, fov: 0.7 },
    thermal: { area: 0.6, surface: 303.15, surroundings: 293.15, h: 8, emissivity: 0.9, mass: 20, power: 180, min: 273.15, max: 323.15 },
    roverPower: 600,
    support: { name: 'Banco de polvo y simulante salino', mass: 180, power: 1800, length: 2.2, width: 1.8, pressure: 101325, min: 273.15, max: 323.15,
      reason: 'Banco terrestre en aire a presión nominal de laboratorio; no es presión observada de Atacama ni presión atmosférica de Jezero.' },
    kit: { name: 'Juego pasivo de recipientes para sales', mass: 3, power: false, key: 'sampleCapacityKg', label: 'Capacidad total de muestra propuesta', value: 1, unit: 'kg',
      purpose: 'Separar muestras y blancos de manipulación fuera del presupuesto del rover.' },
    method: 'Banco terrestre calentado con aire controlado: convección lineal h=8 y radiación gris al cerramiento; no representa la atmósfera marciana.',
  },
  'wind-canyon': {
    title: 'Coprates · navegación y erosión eólica',
    purpose: 'Planificar navegación en pendiente de banco y exposición a viento controlado; el escenario conserva su targetId valles-marineris.',
    sampler: { name: 'Recolector superficial de arena', mass: 8, power: 35, diameter: 0.06, depth: 0.03, thrust: 30, torque: 2, min: 263.15, max: 323.15 },
    wheel: { radius: 0.3, width: 0.22, mass: 5.5, power: 50 },
    camera: { name: 'Par de cámaras de navegación estereoscópica', count: 2, mass: 1.4, power: 20, resolution: 0.01, fov: 1.6 },
    thermal: { area: 0.9, surface: 293.15, surroundings: 283.15, h: 12, emissivity: 0.85, mass: 18, power: 220, min: 263.15, max: 323.15 },
    roverPower: 750,
    support: { name: 'Canal eólico con rampa ajustable', mass: 600, power: 4000, length: 4, width: 2, pressure: 101325, min: 263.15, max: 323.15,
      reason: 'Consigna de aire de laboratorio; viento y pendiente son entradas de ensayo, no observaciones de Coprates ni umbrales de estabilidad.' },
    kit: { name: 'Mástil anemométrico de referencia del banco', mass: 2, power: 4, key: 'heightM', label: 'Altura de medición propuesta', value: 1, unit: 'm',
      purpose: 'Instrumentar el flujo del canal eólico desde un soporte externo.' },
    method: 'Banco terrestre en flujo forzado: h=12 es una hipótesis de cierre, no se deduce del viento ni se declara coeficiente planetario.',
  },
};

function buildProfile(scenarioId, s) {
  const operating = limits(s.thermal.min, s.thermal.max, 'Intervalo objetivo del equipo protegido; no calificación ambiental ni umbral de seguridad.');
  const tools = [
    tool('rover', 'Rover Atlas de referencia de diseño', 'Presupuesto total de masa y potencia del prototipo completo.', 'platform', 1, 'rover-total', [
      p('massKg', 'Masa total del prototipo', ROVER_CONFIG.massKg, 'kg', 'Única masa global: ROVER_CONFIG.massKg; las piezas incluidas ya forman parte de este total.'),
      p('powerW', 'Presupuesto eléctrico nominal', s.roverPower, 'W', 'Propuesta de alimentación simultánea con margen; no consumo medido ni autonomía validada.'),
      p('lengthM', 'Longitud de envolvente propuesta', 1.5, 'm', 'Espacio de integración preliminar del prototipo.'),
      p('widthM', 'Ancho de envolvente propuesta', 1.2, 'm', 'Espacio de integración preliminar del prototipo.'), ...operating,
    ]),
    tool('wheels', 'Ruedas y accionamiento', 'Planificar contacto con el simulante y reparto nominal uniforme.', 'mobility', 6, 'included-in-rover', [
      p('massKg', 'Masa por conjunto rueda', s.wheel.mass, 'kg', 'Masa objetivo de una rueda con accionamiento; contar seis unidades dentro de los 350 kg.'),
      p('powerW', 'Potencia nominal por rueda', s.wheel.power, 'W', 'Presupuesto de motor por rueda para el ensayo, no curva medida de tracción.'),
      p('radiusM', 'Radio nominal de rueda', s.wheel.radius, 'm', 'Geometría propuesta según terreno y movilidad de la misión.'),
      p('widthM', 'Ancho nominal de rueda', s.wheel.width, 'm', 'Geometría propuesta de contacto con el simulante.'),
      p('supportedMassKg', 'Masa soportada nominal por rueda', ROVER_CONFIG.massKg / 6, 'kg', 'ROVER_CONFIG.massKg/6: reparto uniforme en suelo horizontal; no distribución medida ni masa propia de rueda.', 'derived-design'),
      ...operating,
    ]),
    tool('sampler', s.sampler.name, 'Ensayar adquisición de una muestra del simulante seleccionado.', 'sampling', 1, 'included-in-rover', [
      p('massKg', 'Masa del muestreador', s.sampler.mass, 'kg', 'Asignación preliminar dentro de los 350 kg.'),
      p('powerW', 'Potencia nominal del muestreador', s.sampler.power, 'W', 'Presupuesto eléctrico propuesto para muestreo intermitente.'),
      p('diameterM', 'Diámetro activo', s.sampler.diameter, 'm', 'Geometría propuesta para la muestra de simulante.'),
      p('depthM', 'Profundidad de ensayo', s.sampler.depth, 'm', 'Carrera objetivo de banco, no capacidad de penetración demostrada.'),
      p('thrustN', 'Empuje axial de ensayo', s.sampler.thrust, 'N', 'Consigna de actuador independiente de m·g, no validada contra el material.'),
      p('torqueNm', 'Par de ensayo', s.sampler.torque, 'N·m', 'Consigna independiente del empuje; no resistencia medida de roca, hielo o sales.'),
      ...limits(s.sampler.min, s.sampler.max, 'Rango objetivo del mecanismo protegido; no temperatura de la muestra ni calificación criogénica.'),
    ]),
    tool('cameras', s.camera.name, 'Registrar geometría y textura durante el ensayo, con escala calibrable.', 'inspection', s.camera.count, 'included-in-rover', [
      p('massKg', 'Masa por cámara equipada', s.camera.mass, 'kg', 'Incluye carcasa y luz cuando corresponde; asignación por unidad dentro del rover.'),
      p('powerW', 'Potencia nominal por cámara', s.camera.power, 'W', 'Asignación eléctrica por cámara, incluida iluminación propuesta.'),
      p('resolutionM', 'Objetivo de resolución en plano de ensayo', s.camera.resolution, 'm', 'Objetivo de detalle a distancia de banco por definir; no rendimiento óptico validado.'),
      p('fieldOfViewRad', 'Campo angular propuesto', s.camera.fov, 'rad', 'Objetivo preliminar de óptica para la tarea, no especificación de un producto.'), ...operating,
    ]),
    tool('thermal-control', 'Cápsula y control térmico', 'Regular el equipo protegido y medir intercambios en el banco propuesto.', 'thermal-control', 1, 'included-in-rover', [
      p('massKg', 'Masa del conjunto térmico', s.thermal.mass, 'kg', 'Presupuesto de aislamiento, placa y control incluido en los 350 kg.'),
      p('powerW', 'Presupuesto eléctrico térmico', s.thermal.power, 'W', 'Capacidad nominal propuesta; el balance base omite conducción y transitorios.'),
      p('heatSetpointK', 'Consigna de superficie del equipo', s.thermal.surface, 'K', 'Misma superficie del modelo thermal; no temperatura del terreno ni del aire.'), ...operating,
    ]),
    tool('dosimeter', 'Dosímetro electrónico de ensayo', 'Preparar adquisición instrumental futura sin asignar radiación ambiental al escenario.', 'radiation-monitoring', 1, 'included-in-rover', [
      p('massKg', 'Masa objetivo del dosímetro', 0.8, 'kg', 'Presupuesto de carcasa y electrónica; no ficha comercial.'),
      p('powerW', 'Potencia objetivo del dosímetro', 2, 'W', 'Asignación de alimentación para adquisición futura.'),
      p('doseRateMinGyS', 'Extremo inferior objetivo del rango instrumental', 1e-9, 'Gy/s', 'Objetivo de selección del instrumento; sin calibración ni lectura ambiental.'),
      p('doseRateMaxGyS', 'Extremo superior objetivo del rango instrumental', 1e-4, 'Gy/s', 'Objetivo de selección, sin convertir dosis absorbida en dosis equivalente o riesgo.'),
      na('environmentalDoseRateGyS', 'Tasa de dosis ambiental', 'sin medición ni fuente ambiental; el rango instrumental no es una dosis de misión'), ...operating,
    ]),
    tool('support-bench', s.support.name, 'Proveer condiciones reproducibles de laboratorio separadas de la misión real.', 'test-support', 1, 'test-equipment', [
      p('massKg', 'Masa de banco propuesta', s.support.mass, 'kg', 'Equipo fijo de laboratorio, excluido de la masa del rover.'),
      p('powerW', 'Potencia de banco propuesta', s.support.power, 'W', 'Presupuesto de instalación externa, excluido del consumo del rover.'),
      p('lengthM', 'Longitud útil de banco', s.support.length, 'm', 'Envolvente inicial para planificar la instalación de ensayo.'),
      p('widthM', 'Ancho útil de banco', s.support.width, 'm', 'Envolvente inicial para planificar la instalación de ensayo.'),
      p('pressurePa', 'Consigna de presión absoluta de banco', s.support.pressure, 'Pa', s.support.reason),
      ...limits(s.support.min, s.support.max, 'Intervalo propuesto de pared o cerramiento; en cámara fría difiere de la temperatura del equipo protegido.'),
      ...(scenarioId === 'wind-canyon' ? [
        p('windSetpointMs', 'Velocidad nominal del canal', 12, 'm/s', 'Entrada de ensayo terrestre; no viento observado ni umbral de saltación marciano.'),
        p('slopeSetpointRad', 'Pendiente nominal de rampa', 0.17, 'rad', 'Aproximadamente 10 grados como ensayo inicial, sin afirmar límite de vuelco o tracción.'),
      ] : []),
    ]),
    tool('external-kit', s.kit.name, s.kit.purpose, 'external-support', 1, 'external-kit', [
      p('massKg', 'Masa del kit externo', s.kit.mass, 'kg', 'Equipo de soporte separado; no añadir a los 350 kg sin rediseño de integración.'),
      ...(s.kit.power === false ? [na('powerW', 'Potencia del kit', 'recipientes pasivos sin alimentación eléctrica')] : [
        p('powerW', 'Potencia nominal del kit', s.kit.power, 'W', 'Alimentación externa propuesta, fuera del presupuesto eléctrico del rover.'),
      ]),
      p(s.kit.key, s.kit.label, s.kit.value, s.kit.unit, 'Dimensión o capacidad nominal propuesta para la tarea de soporte.'),
      ...limits(273.15, 313.15, 'Rango objetivo del kit externo en zona de laboratorio; no debe colocarse dentro de la cámara fría sin rediseño.'),
    ]),
  ];
  return {
    schema: 'MissionBaseProfile', version: BASE_PROFILE_VERSION, id: `m2-base-${scenarioId}`, scenarioId,
    title: s.title, revisionDate: '2026-11-14', purpose: s.purpose, kind: DESIGN, source: SOURCE,
    assumptions: [
      'Propuesta de diseño de versión estática; no observación, telemetría, ficha de vuelo NASA ni umbral de seguridad validado. Todos los equipos están desconectados.',
      'La única masa total del rover es ROVER_CONFIG.massKg = 350 kg; masas y potencias de componentes son por unidad y están incluidas, no se suman de nuevo al rover.',
      'massScope distingue rover-total, included-in-rover, external-kit y test-equipment; el resto de masa queda reservado para estructura, energía y cableado sin un desglose validado.',
      'Seis ruedas en suelo horizontal con reparto nominal uniforme de 350/6 kg por rueda; no representa transferencia de carga en pendiente ni distribución medida.',
      'Potencia del rover es presupuesto nominal simultáneo con margen; banco y kit externo tienen suministro separado. No se estima autonomía ni se atribuye este consumo a Perseverance.',
      'Empuje y par del muestreador son consignas de actuadores independientes, no fuerzas derivadas de masa por gravedad y no ensayos de material completados.',
      s.method,
      'thermal describe solo superficie del equipo y pared de banco; no aire meteorológico, superficie NASA/Diviner ni temperatura real de la misión. Área, emisividad y h son hipótesis de ensayo.',
      'Modelo base: Qconv=h·A·(Ts−Tpared); Qrad=ε·σ·A·(Ts⁴−Tpared⁴), vista unitaria, estado estacionario. Excluye sol, conducción, polvo, gas residual y calor interno; no es dimensionamiento térmico validado.',
      'Los rangos operativos son objetivos de selección de equipo protegido, separados de consignas de pared y muestra; no certifican supervivencia en ambientes planetarios.',
      'El dosímetro solo define un rango instrumental propuesto; tasa de dosis ambiental no aplicable por ausencia de medición y fuente. No se infiere dosis de imágenes ni de colores NASA.',
    ],
    thermal: {
      areaM2: quantity(s.thermal.area, 'm²', 'Área efectiva de la cápsula propuesta para el modelo de banco.'),
      surfaceK: quantity(s.thermal.surface, 'K', 'Consigna de superficie del equipo protegido; no temperatura del suelo ni del aire.'),
      surroundingsK: quantity(s.thermal.surroundings, 'K', 'Consigna de pared radiativa del banco; no temperatura planetaria observada.'),
      hWm2K: quantity(s.thermal.h, 'W/m²/K', s.method),
      emissivity: quantity(s.thermal.emissivity, '1', 'Emisividad gris asumida para diseño; no obtenida de colores o texturas NASA.'),
    }, tools,
  };
}

const PROFILES = Object.fromEntries(Object.entries(SPECS).map(([id, spec]) => [id, buildProfile(id, spec)]));

export function getMissionBaseProfile(scenarioOrId) {
  const id = typeof scenarioOrId === 'string' ? scenarioOrId : scenarioOrId?.id;
  if (typeof id !== 'string' || !Object.hasOwn(PROFILES, id)) {
    throw new RangeError(`Perfil base de misión no soportado: ${String(id)}`);
  }
  return structuredClone(PROFILES[id]);
}

export function validateMissionBaseProfile(profile) {
  const errors = [];
  const error = (path, message) => errors.push(`${path}: ${message}`);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.trim().toLowerCase() !== 'null';
  const seen = new WeakSet();
  function scan(value, path) {
    if (value === null || value === undefined) return error(path, 'valor nulo o ausente');
    if (typeof value === 'number' && !Number.isFinite(value)) return error(path, 'número no finito');
    if (typeof value === 'string' && !nonempty(value)) return error(path, 'texto vacío o null');
    if (typeof value === 'object') {
      if (seen.has(value)) return error(path, 'estructura cíclica');
      seen.add(value);
      for (const [key, child] of Object.entries(value)) scan(child, `${path}.${key}`);
      seen.delete(value);
    } else if (!['string', 'number', 'boolean'].includes(typeof value)) error(path, 'tipo no serializable');
  }
  scan(profile, 'profile');
  if (!object(profile)) return { valid: false, errors: [...errors, 'profile: se requiere un objeto'] };
  for (const [key, expected] of Object.entries({ schema: 'MissionBaseProfile', version: BASE_PROFILE_VERSION, revisionDate: '2026-11-14', kind: DESIGN, source: SOURCE })) {
    if (profile[key] !== expected) error(key, `se requiere ${expected}`);
  }
  if (!Object.hasOwn(SPECS, profile.scenarioId ?? '')) error('scenarioId', 'misión no soportada');
  if (profile.id !== `m2-base-${profile.scenarioId}`) error('id', 'debe corresponder a scenarioId');
  for (const key of ['title', 'purpose']) if (!nonempty(profile[key])) error(key, 'texto obligatorio');
  if (!Array.isArray(profile.assumptions) || !profile.assumptions.length || !profile.assumptions.every(nonempty)) error('assumptions', 'lista de supuestos no vacíos obligatoria');
  function provenance(item, path, allowNA = false) {
    if (!object(item)) { error(path, 'se requiere una cantidad con procedencia'); return false; }
    if (!KINDS.has(item.kind) || (!allowNA && item.kind === 'not-applicable')) error(`${path}.kind`, 'clase no permitida');
    if (!nonempty(item.source) || !/^(docs\/[^\s]+\.md(?:#[^\s]+)?|https:\/\/[^\s]+)$/.test(item.source)) error(`${path}.source`, 'documento local o URL HTTPS obligatorio');
    if (!nonempty(item.rationale)) error(`${path}.rationale`, 'justificación obligatoria');
    if (!nonempty(item.unit)) error(`${path}.unit`, 'unidad obligatoria');
    const value = item.value;
    if (!(typeof value === 'number' && Number.isFinite(value)) && !(typeof value === 'string' && nonempty(value)) && typeof value !== 'boolean') error(`${path}.value`, 'valor escalar finito obligatorio');
    if (item.kind === 'not-applicable' && (typeof value !== 'string' || !/^No aplica: .+/.test(value) || item.unit !== 'No aplica')) error(path, 'no aplicable debe tener motivo y unidad No aplica');
    return true;
  }
  if (!object(profile.thermal)) error('thermal', 'modelo de ensayo obligatorio');
  else for (const [key, unit] of Object.entries(THERMAL_UNITS)) {
    const q = profile.thermal[key], path = `thermal.${key}`;
    if (!provenance(q, path)) continue;
    if (q.unit !== unit) error(`${path}.unit`, `se requiere ${unit}`);
    if (typeof q.value !== 'number' || !Number.isFinite(q.value) || (key === 'hWm2K' ? q.value < 0 : q.value <= 0) || (key === 'emissivity' && q.value > 1)) error(`${path}.value`, 'fuera de rango físico del modelo');
  }
  if (!Array.isArray(profile.tools) || !profile.tools.length) error('tools', 'herramientas obligatorias');
  else {
    const ids = new Set(); let includedMass = 0, includedPower = 0;
    for (const [i, t] of profile.tools.entries()) {
      const path = `tools[${i}]`;
      if (!object(t)) { error(path, 'herramienta inválida'); continue; }
      for (const key of ['id', 'name', 'purpose', 'role']) if (!nonempty(t[key])) error(`${path}.${key}`, 'texto obligatorio');
      if (ids.has(t.id)) error(`${path}.id`, 'identificador duplicado'); ids.add(t.id);
      if (!Number.isInteger(t.quantity) || t.quantity <= 0) error(`${path}.quantity`, 'entero positivo obligatorio');
      if (!SCOPES.has(t.massScope)) error(`${path}.massScope`, 'ámbito de masa no permitido');
      if (t.status !== 'proposed-design' || t.connected !== false) error(path, 'debe ser diseño propuesto desconectado');
      if (!Array.isArray(t.parameters) || !t.parameters.length) { error(`${path}.parameters`, 'parámetros obligatorios'); continue; }
      const keys = new Set(), values = new Map();
      for (const [j, param] of t.parameters.entries()) {
        const pp = `${path}.parameters[${j}]`;
        if (!provenance(param, pp, true)) continue;
        for (const key of ['key', 'label']) if (!nonempty(param[key])) error(`${pp}.${key}`, 'texto obligatorio');
        if (keys.has(param.key)) error(`${pp}.key`, 'parámetro duplicado'); keys.add(param.key); values.set(param.key, param.value);
        if (param.kind !== 'not-applicable' && UNITS[param.key]) {
          if (param.unit !== UNITS[param.key]) error(`${pp}.unit`, `se requiere ${UNITS[param.key]}`);
          if (typeof param.value !== 'number' || !Number.isFinite(param.value) || param.value < 0) error(`${pp}.value`, 'cantidad SI no negativa obligatoria');
          if ((param.key.endsWith('K') || ['massKg', 'radiusM', 'widthM', 'lengthM', 'heightM', 'diameterM', 'depthM', 'resolutionM', 'fieldOfViewRad'].includes(param.key)) && param.value <= 0) error(`${pp}.value`, 'cantidad estrictamente positiva obligatoria');
          if (param.key === 'fieldOfViewRad' && param.value > 2 * Math.PI) error(`${pp}.value`, 'campo angular superior a una vuelta');
          if (param.key === 'slopeSetpointRad' && param.value >= Math.PI / 2) error(`${pp}.value`, 'rampa fuera del intervalo de ensayo');
        }
      }
      const requiredParameters = Object.hasOwn(TOOL_PARAMETERS, t.id) ? TOOL_PARAMETERS[t.id] : [];
      for (const key of ['massKg', 'powerW', 'operatingMinK', 'operatingMaxK', ...requiredParameters]) if (!keys.has(key)) error(`${path}.parameters`, `falta ${key} (usar no aplicable con motivo si corresponde)`);
      if (typeof values.get('operatingMinK') === 'number' && typeof values.get('operatingMaxK') === 'number' && values.get('operatingMinK') > values.get('operatingMaxK')) error(path, 'rango térmico invertido');
      if (t.massScope === 'included-in-rover' && Number.isFinite(values.get('massKg'))) includedMass += t.quantity * values.get('massKg');
      if (t.massScope === 'included-in-rover' && Number.isFinite(values.get('powerW'))) includedPower += t.quantity * values.get('powerW');
      if (t.id === 'rover' && (t.massScope !== 'rover-total' || t.quantity !== 1 || values.get('massKg') !== ROVER_CONFIG.massKg)) error(path, 'masa total debe ser ROVER_CONFIG.massKg, sin sumar componentes');
      if (t.id === 'wheels' && (t.massScope !== 'included-in-rover' || t.quantity !== 6 || values.get('supportedMassKg') !== ROVER_CONFIG.massKg / 6 || t.parameters.find(v => v?.key === 'supportedMassKg')?.kind !== 'derived-design')) error(path, 'reparto nominal uniforme requiere seis ruedas y masa derivada de ROVER_CONFIG');
      if (t.id === 'dosimeter' && t.parameters.find(v => v?.key === 'environmentalDoseRateGyS')?.kind !== 'not-applicable') error(path, 'no se permite inventar dosis ambiental');
      if (t.id === 'thermal-control' && values.get('heatSetpointK') !== profile.thermal?.surfaceK?.value) error(path, 'consigna térmica debe corresponder a la superficie del modelo');
      for (const [min, max] of [['doseRateMinGyS', 'doseRateMaxGyS']]) if (values.has(min) && values.has(max) && values.get(min) > values.get(max)) error(path, 'rango instrumental invertido');
    }
    for (const id of ['rover', 'wheels', 'sampler', 'cameras', 'thermal-control', 'dosimeter', 'support-bench', 'external-kit']) if (!ids.has(id)) error('tools', `falta herramienta ${id}`);
    if (includedMass > ROVER_CONFIG.massKg) error('tools', 'masas incluidas superan la masa total del rover');
    const roverParameters = profile.tools.find(t => t?.id === 'rover')?.parameters;
    const roverPower = Array.isArray(roverParameters) ? roverParameters.find(p => p?.key === 'powerW')?.value : undefined;
    if (Number.isFinite(roverPower) && includedPower > roverPower) error('tools', 'potencia simultánea de componentes supera presupuesto del rover');
  }
  return { valid: errors.length === 0, errors };
}
