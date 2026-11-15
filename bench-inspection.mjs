// Proyecciones del inspector M2. No modifica el motor, el candidato ni el registro.
import { benchState } from './nasa-visual-math.mjs';
import { compareTerrain } from './similarity.mjs';

const finite = n => typeof n === 'number' && Number.isFinite(n);
const num = n => finite(n) ? n : null;
export const BENCH_COLORS = Object.freeze({ earth: '#ffa7b8', target: '#ffd275', support: '#69cfff', contact: '#63ecd3', gas: '#69cfff', heat: '#ffa557', unknown: '#92a3bc' });
export const inspectionValue = (n, unit = '') => finite(n)
  ? `${n !== 0 && Math.abs(n) < .01 ? n.toExponential(2) : n.toLocaleString('es-ES', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}` : 'Sin dato';
const fact = (label, value, unit = '', color = 'unknown', note = '') => ({ label, value: typeof value === 'string' ? value : inspectionValue(value, unit), color, note });

// Una referencia común permite comparar los dos métodos sin reescalar sus flechas.
export function forceReference(calibration) {
  const g = calibration?.gravity;
  return Math.max(Math.abs(g?.earthWeightN || 0), Math.abs(g?.targetWeightN || 0), Math.abs(g?.offloadForceN || 0), 1);
}
export function signedFraction(value, maximum) {
  return finite(value) && finite(maximum) && maximum > 0 ? Math.max(-1, Math.min(1, value / maximum)) : null;
}
// La dirección meteorológica indica DE DÓNDE viene. +X este, −Z norte.
export function windVector(speed, fromDeg) {
  if (!finite(speed) || speed < 0 || !finite(fromDeg) || fromDeg < 0 || fromDeg > 360) return null;
  const angle = fromDeg * Math.PI / 180;
  return { speed, fromDeg, toward: [-Math.sin(angle), 0, Math.cos(angle)] };
}

// Muestreo de vértices del DEM real, con la misma escala XY y Z para ambos sitios.
// Ninguna superficie se sintetiza a partir de una pendiente estadística.
export function terrainPair(candidate, grids = {}) {
  const result = ['earth', 'target'].map(side => {
    const g = grids[side], site = candidate?.[side], n = g?.gridSize;
    if (!site?.id || g?.id !== site.id || g.body !== site.body || !Number.isInteger(n) || n < 2 || !Array.isArray(g.elevation)
      || g.elevation.length !== n * n || !g.elevation.every(finite) || !finite(g.extentMeters) || g.extentMeters <= 0) return null;
    const count = Math.min(n, 33), vertices = [];
    const minimum = g.elevation.reduce((a, b) => Math.min(a, b), Infinity), maximum = g.elevation.reduce((a, b) => Math.max(a, b), -Infinity);
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      const r = Math.round(row * (n - 1) / (count - 1)), c = Math.round(col * (n - 1) / (count - 1));
      vertices.push([col / (count - 1) * g.extentMeters, g.elevation[r * n + c] - minimum, row / (count - 1) * g.extentMeters]);
    }
    return { side, count, vertices, minimum, range: maximum - minimum, extent: g.extentMeters };
  });
  const extent = Math.max(...result.map(g => g?.extent || 0), 1), range = Math.max(...result.map(g => g?.range || 0), 1);
  return { surfaces: result, extent, exaggeration: Math.max(1, Math.min(12, extent * .32 / range)) };
}

export function buildBenchInspection({ calibration, candidate, factor = 'gravity', mode = 'offload', grids, source = 'mission' } = {}) {
  const state = benchState(calibration, mode), i = calibration?.inputs || {}, e = candidate?.earth, t = candidate?.target;
  const manual = source === 'manual', base = source === 'design';
  const scope = base ? 'BASE PROPUESTA · SIN MEDIR' : manual ? 'HIPÓTESIS MANUALES · AISLADAS' : 'CONFIGURACIÓN + FUENTES DE MISIÓN';
  const common = { factor, state, scope, methodRelevant: ['gravity', 'regolith'].includes(factor), modelVisible: true, facts: [], legend: [], sourceNote: '', scale: '', data: {} };
  const view = (title, question, read, benefit, next, extra) => ({ ...common, title, question, read, benefit, next, ...extra });
  if (factor === 'gravity') {
    const max = forceReference(calibration), fraction = state.known ? state.testMassKg / state.originalMassKg : null;
    return view('Balance de fuerzas', '¿Cómo reproducir la carga del objetivo sobre suelo terrestre?',
      'W apunta hacia abajo y N hacia arriba. F positiva descarga hacia arriba; negativa exige carga adicional hacia abajo. Se cumple W − F = N. Las tres fuerzas pertenecen al mismo ensayo terrestre.',
      mode === 'offload' ? 'Dimensioná la descarga vertical conservando la masa del equipo. La inercia ideal permanece; el soporte real agrega restricciones.' : 'Dimensioná un prototipo aligerado. Igualás la carga estática, pero su masa y su respuesta inercial cambian.',
      'Contrastá ambos métodos antes de elegir el banco. El peso original queda como referencia fija; el suelo sigue a gravedad terrestre.', {
        scale: `Flechas lineales: longitud máxima = ${inspectionValue(max, 'N')}, fija entre ambos métodos. N es la reacción total, sin reparto por rueda.`,
        data: { max, fraction },
        facts: [fact('Masa original', state.originalMassKg, 'kg', 'earth'), fact('Masa ensayada', state.testMassKg, 'kg', 'support'),
          fact('W · peso en Tierra', state.testEarthWeightN, 'N', 'earth'), fact('F · soporte vertical', state.supportN, 'N', 'support'),
          fact('N · reacción / carga objetivo', state.contactLoadN, 'N', 'contact'), fact('Masa ensayada / original', finite(fraction) ? fraction * 100 : null, '%', 'target', 'La masa reducida modifica la inercia.')],
        legend: [fact('W ↓', state.testEarthWeightN, 'N', 'earth'), fact('F · signo + hacia arriba', state.supportN, 'N', 'support'), fact('N ↑', state.contactLoadN, 'N', 'contact')],
      });
  }
  if (factor === 'pressure') {
    const earth = num(i.earthPressurePa), target = num(i.targetPressurePa);
    return view('Presión absoluta', '¿Qué salto de presión debe cubrir el ensayo?',
      'Dos recintos comparan presiones. Las flechas entrantes indican compresión normal a sus caras; su longitud usa una escala logarítmica común.',
      'Definí la presión de operación de la cámara y detectá cuánto difiere del ambiente terrestre. Δp entre ambientes no es una carga calculada sobre una carcasa.',
      'Para evaluar sellos o esfuerzos faltan presión interior, área y geometría de la pieza. La descarga de peso no resuelve esta diferencia.', {
        modelVisible: false, data: { earth, target, max: Math.max(earth || 0, target || 0, 1) },
        scale: 'Flechas: log(1 + p/1 Pa), misma escala para ambos recintos. 0 Pa: sin flechas. No representan fuerza en N.',
        sourceNote: manual ? 'Presiones del laboratorio manual.' : 'Tierra: presión superficial del proveedor y fecha en la misión. Luna: 0 Pa ideal; Marte: 636 Pa de referencia, sin medición local.',
        facts: [fact('Presión Tierra', earth, 'Pa', 'earth'), fact('Presión objetivo del ensayo', target, 'Pa', 'target'), fact('Δp · Tierra − objetivo', calibration?.pressure?.differencePa, 'Pa', 'support'), fact('p objetivo / p Tierra', calibration?.pressure?.targetToEarthRatio, '', 'contact')],
        legend: [fact('Recinto Tierra', earth, 'Pa', 'earth'), fact('Recinto objetivo', target, 'Pa', 'target')],
      });
  }
  if (factor === 'atmosphere') {
    const weather = e?.telemetry, speed = finite(weather?.values?.windSpeedMs) && weather.values.windSpeedMs >= 0 ? weather.values.windSpeedMs : null;
    const wind = windVector(speed, weather?.values?.windDirDeg);
    return view('Gas y flujo atmosférico', '¿Qué ambiente gaseoso sigue sin reproducir el análogo?',
      'La brújula muestra el viento terrestre: la flecha apunta hacia donde sopla, en ejes este/norte. El recinto representa el gas del banco, sin partículas inventadas.',
      'Orientá una prueba de exposición al viento y separá movilidad de pruebas en cámara. Velocidad del viento no equivale a fuerza de arrastre.',
      'Para extrapolar al objetivo hacen falta composición, densidad, velocidad y régimen de flujo propios. h térmico no se deduce desde presión o viento.', {
        data: { wind, speed },
        sourceNote: weather ? `Viento Tierra: ${weather.provider || 'proveedor'} · ${weather.live === true ? 'modelo meteorológico' : 'archivo'} · ${weather.observedAt || 'sin fecha'}.` : 'Sin viento terrestre disponible; se retira su vector.',
        scale: 'La dirección es geográfica; el largo del vector es un símbolo de orientación, no una fuerza ni una escala de velocidad.',
        facts: [fact('Viento Tierra', speed, 'm/s', 'gas'), fact('Procedencia del viento · desde', wind?.fromDeg, '°', 'gas'),
          fact('Gas terrestre · contexto', e?.environment?.atmosphere || 'Sin dato'), fact('Gas objetivo · contexto', t?.environment?.atmosphere || 'Sin dato'), fact('Densidad / arrastre objetivo', 'Sin dato')],
        legend: [fact('Viento Tierra', speed, 'm/s', 'gas'), fact('Flujo objetivo', 'Sin vector disponible', '', 'target')],
      });
  }
  if (factor === 'temperature') {
    const temperatures = [num(i.surfaceK), num(i.airK), num(i.surroundingsK)], surface = t?.surfaceTemperature;
    const max = Math.max(500, ...temperatures.filter(finite), surface?.maxK || 0);
    return view('Tres temperaturas, tres funciones', '¿Qué se conoce del equipo, del gas y del entorno radiativo?',
      'Las columnas separan Ts del equipo, Ta del gas y Tr del entorno radiativo. Una columna vacía significa dato pendiente. La banda adicional pertenece al suelo del objetivo.',
      'Prepará los setpoints de un ensayo térmico sin confundir temperatura del aire, del suelo y del equipo. La banda del terreno ayuda a elegir condiciones a estudiar.',
      'Revisá el diseño base propuesto o ingresá hipótesis en el laboratorio. El rango superficial no es el rango operativo certificado del rover.', {
        data: { temperatures, max, surface }, scale: `Columnas lineales de 0 a ${inspectionValue(max, 'K')}. Sin vectores: la temperatura es escalar, no un flujo de calor.`,
        sourceNote: `Banda superficial del objetivo: ${surface?.kind || 'desconocido'} · ${surface?.source || 'sin fuente'}. No corresponde al equipo.`,
        facts: [fact('Ts · superficie del equipo', temperatures[0], 'K', 'heat'), fact('Ta · gas del ensayo', temperatures[1], 'K', 'gas'), fact('Tr · entorno radiativo', temperatures[2], 'K', 'target'), fact('Suelo objetivo · mínimo', surface?.minK, 'K', 'target'), fact('Suelo objetivo · máximo', surface?.maxK, 'K', 'target')],
        legend: [fact('Equipo Ts', temperatures[0], 'K', 'heat'), fact('Gas Ta', temperatures[1], 'K', 'gas'), fact('Entorno Tr', temperatures[2], 'K', 'target')],
      });
  }
  if (factor === 'heat-transfer') {
    const convection = num(calibration?.thermal?.convectionW), radiation = num(calibration?.thermal?.radiationW), max = Math.max(Math.abs(convection || 0), Math.abs(radiation || 0), 1);
    return view('Por dónde entra o sale el calor', '¿Qué mecanismo enfría o calienta el equipo en este banco?',
      'Azul: intercambio con el gas. Naranja: intercambio con el entorno radiativo. Q > 0 sale del equipo; Q < 0 entra. Si Q = 0 no hay flecha; sin dato tampoco se dibuja flujo.',
      'Identificá qué mecanismo exige controlar el gas o las paredes de la cámara. Compará su magnitud y detectá ganancias de calor antes de planificar refrigeración.',
      'Completá área, temperaturas, h y emisividad, o explorá la base propuesta. Faltan conducción, Sol, albedo, disipación interna y transitorios para cerrar el balance.', {
        data: { convection, radiation, max }, scale: `Flechas lineales en escala común: máximo ${inspectionValue(max, 'W')}. La posición de los nodos es esquemática.`,
        sourceNote: 'Qconv = h·A·(Ts − Ta). Qrad = ε·σ·A·(Ts⁴ − Tr⁴), superficie gris y factor de vista 1. El método gravitatorio no altera estas Q.',
        facts: [fact('Q convección · + pérdida', convection, 'W', 'gas'), fact('Q radiación térmica · + pérdida', radiation, 'W', 'heat'), fact('Área expuesta', i.areaM2, 'm²'), fact('h del gas', i.hWm2K, 'W/m²/K'), fact('Emisividad ε', i.emissivity), fact('Ts / Ta / Tr', temperaturesText(i))],
        legend: [fact('Gas ↔ equipo', convection, 'W', 'gas'), fact('Entorno ↔ equipo', radiation, 'W', 'heat')],
      });
  }
  if (factor === 'radiation') {
    const solar = num(e?.telemetry?.values?.solarRadiationWm2), reference = num(t?.environment?.solarConstantWm2);
    const earthDose = num(e?.ionizingDoseRate?.value), targetDose = num(t?.ionizingDoseRate?.value);
    return view('Energía solar y dosis: canales distintos', '¿Qué exposición podemos comparar y cuál exige medir?',
      'Las barras comparan irradiancia terrestre del proveedor y referencia solar del objetivo fuera de la atmósfera. El dosímetro separado permanece vacío mientras no haya dosis.',
      'Distinguí el estudio de carga solar de la evaluación de blindaje. Una irradiancia en W/m² nunca valida protección contra radiación ionizante.',
      'Medí dosis y espectro, y modelá blindaje y geometría. La referencia solar no incluye sombra, hora local, nubes ni polvo del sitio objetivo.', {
        modelVisible: false, data: { solar, reference, earthDose, targetDose, max: Math.max(solar || 0, reference || 0, 1) },
        scale: 'Barras de irradiancia lineales con escala común en W/m². No hay vector de dosis ni dirección solar medida en esta vista.',
        sourceNote: `Tierra: ${e?.telemetry?.provider || 'sin proveedor'} · ${e?.telemetry?.observedAt || 'sin fecha'}. Objetivo: constante solar de referencia del escenario, no irradiancia local.`,
        facts: [fact('Irradiancia Tierra · proveedor', solar, 'W/m²', 'earth'), fact('Referencia solar objetivo · exterior', reference, 'W/m²', 'target'), fact('Dosis ionizante Tierra', earthDose, 'Sv/s'), fact('Dosis ionizante objetivo', targetDose, 'Sv/s')],
        legend: [fact('Solar Tierra', solar, 'W/m²', 'earth'), fact('Solar objetivo · referencia', reference, 'W/m²', 'target'), fact('Dosímetro', targetDose, 'Sv/s')],
      });
  }
  if (factor === 'regolith') {
    return view('Carga conocida, respuesta del suelo pendiente', '¿Qué parte del contacto rueda–suelo podemos ensayar?',
      'La flecha verde indica la reacción normal total N bajo el equipo. El corte de suelo es un esquema sin propiedades asignadas. No se reparte N uniformemente entre ruedas.',
      'Fijá la carga estática de un ensayo de contacto. Detectá qué caracterización falta antes de interpretar hundimiento, tracción o perforación.',
      'Medí granulometría, cohesión, fricción y compactación. La gravedad terrestre del material granular no cambia al descargar el rover.', {
        data: { max: forceReference(calibration) }, scale: 'Solo N tiene magnitud calculada. Sin flechas de tracción, hundimiento, empuje de taladro o par: faltan propiedades y ensayos.',
        facts: [fact('N · reacción normal total', state.contactLoadN, 'N', 'contact'), fact('Masa del equipo ensayado', state.testMassKg, 'kg', 'support'), fact('Cohesión / fricción', 'Sin dato'), fact('Granulometría / compactación', 'Sin dato'), fact('Tracción / hundimiento', 'Sin cálculo')],
        legend: [fact('N ↑', state.contactLoadN, 'N', 'contact'), fact('Subsuelo', 'Propiedades sin medir')],
      });
  }
  if (factor === 'geometry') {
    const terrain = terrainPair(candidate, grids), geometry = compareTerrain(e, t);
    return view('Relieve real, a escala compartida', '¿El análogo ofrece obstáculos geométricos comparables?',
      'Dos superficies se muestrean de los DEM cargados. Comparten escala horizontal y exageración vertical; cada altura se mide respecto al mínimo de su propia ventana.',
      'Contrastá pendientes, desnivel y TRI para elegir recorridos de ensayo. El índice resume geometría; no incluye suelo, gravedad ni ambiente.',
      'Inspeccioná las diferencias y la resolución antes de transferir una ruta. Esta vista regional no identifica piedras o escalones del tamaño de una rueda.', {
        modelVisible: false, data: { terrain, geometry },
        scale: `Ventana común representada: ${inspectionValue(terrain.extent, 'm')}. Exageración vertical ×${inspectionValue(terrain.exaggeration)} en ambos DEM. Norte: fondo; este: derecha. Sin vectores de fuerza.`,
        sourceNote: `${e?.grid?.dataset || 'DEM Tierra pendiente'} ↔ ${t?.grid?.dataset || 'DEM objetivo pendiente'}. ${geometry.comparable ? '' : 'Comparabilidad de resolución insuficiente; resultado orientativo.'}`,
        facts: [fact('Índice geométrico · sin umbral físico', geometry.index, '/100', 'contact'),
          ...['earth', 'target'].flatMap(side => [fact(`${side === 'earth' ? 'Tierra' : 'Objetivo'} · pendiente p90`, candidate?.[side]?.metrics?.slopeP90Deg, '°', side), fact(`${side === 'earth' ? 'Tierra' : 'Objetivo'} · desnivel p95−p5`, candidate?.[side]?.metrics?.reliefP95P5M, 'm', side)] )],
        legend: [fact('DEM Tierra', terrain.surfaces[0] ? 'Rejilla real' : 'Sin rejilla', '', 'earth'), fact('DEM objetivo', terrain.surfaces[1] ? 'Rejilla real' : 'Sin rejilla', '', 'target')],
      });
  }
  return view('Qué tamaño de detalle podés resolver', '¿La rejilla permite inspeccionar el detalle que interesa?',
    'Los dos mosaicos muestran el paso de la rejilla procesada; el recuadro coloreado marca un píxel nativo dentro de una ventana de detalle común. Más interpolación no agrega mediciones.',
    'Elegí si el DEM sirve para relieve regional o si hace falta un levantamiento más fino para ruedas, grietas o perforación.',
    'Contrastá resolución nativa, paso y extensión. La malla NASA está normalizada y no puede usarse para medir dimensiones del prototipo.', {
      factor: 'scale', modelVisible: false, data: { earth: e?.grid, target: t?.grid },
      scale: 'Paneles a escala métrica común; píxel nativo sobre la misma ventana de detalle. Sin vectores: resolución y extensión son longitudes.',
      facts: ['earth', 'target'].flatMap(side => { const g = candidate?.[side]?.grid, label = side === 'earth' ? 'Tierra' : 'Objetivo'; return [fact(`${label} · píxel nativo`, g?.nativeResolutionMeters, 'm', side), fact(`${label} · paso procesado`, g?.spacingMeters, 'm', side), fact(`${label} · extensión`, g?.extentMeters, 'm', side)]; }),
      legend: [fact('Píxel nativo Tierra', e?.grid?.nativeResolutionMeters, 'm', 'earth'), fact('Píxel nativo objetivo', t?.grid?.nativeResolutionMeters, 'm', 'target')],
    });
}
function temperaturesText(i) { return [i.surfaceK, i.airK, i.surroundingsK].map(n => inspectionValue(n, 'K')).join(' / '); }
