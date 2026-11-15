// Proyecciones del inspector M2. No modifica el motor, el candidato ni el registro.
import { benchState } from './nasa-visual-math.mjs';
import { compareTerrain } from './similarity.mjs';

const finite = n => typeof n === 'number' && Number.isFinite(n);
const num = n => finite(n) ? n : null;
export const BENCH_COLORS = Object.freeze({ earth: '#ffa7b8', target: '#ffd275', support: '#69cfff', contact: '#63ecd3', gas: '#69cfff', heat: '#ffa557', unknown: '#92a3bc' });
export const inspectionValue = (n, unit = '') => finite(n)
  ? `${n !== 0 && Math.abs(n) < .01 ? n.toExponential(2) : n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}` : 'No data';
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
  const scope = base ? 'PROPOSED BASELINE · UNMEASURED' : manual ? 'MANUAL HYPOTHESES · ISOLATED' : 'CONFIGURATION + MISSION SOURCES';
  const common = { factor, state, scope, methodRelevant: ['gravity', 'regolith'].includes(factor), modelVisible: true, facts: [], legend: [], sourceNote: '', scale: '', data: {} };
  const view = (title, question, read, benefit, next, extra) => ({ ...common, title, question, read, benefit, next, ...extra });
  if (factor === 'gravity') {
    const max = forceReference(calibration), fraction = state.known ? state.testMassKg / state.originalMassKg : null;
    return view('Force balance', 'How do we reproduce the target load on Earth ground?',
      'W points down and N points up. Positive F offloads upward; negative F requires additional downward load. W − F = N holds. All three forces belong to the same Earth test.',
      mode === 'offload' ? 'Size the vertical offload while keeping the equipment mass. Ideal inertia is preserved; the real support adds constraints.' : 'Size a lightened prototype. You match the static load, but its mass and inertial response change.',
      'Compare both methods before choosing the bench. The original weight stays as a fixed reference; the ground remains under Earth gravity.', {
        scale: `Linear arrows: maximum length = ${inspectionValue(max, 'N')}, fixed across both methods. N is the total reaction, not split per wheel.`,
        data: { max, fraction },
        facts: [fact('Original mass', state.originalMassKg, 'kg', 'earth'), fact('Tested mass', state.testMassKg, 'kg', 'support'),
          fact('W · weight on Earth', state.testEarthWeightN, 'N', 'earth'), fact('F · vertical support', state.supportN, 'N', 'support'),
          fact('N · reaction / target load', state.contactLoadN, 'N', 'contact'), fact('Tested / original mass', finite(fraction) ? fraction * 100 : null, '%', 'target', 'The reduced mass changes inertia.')],
        legend: [fact('W ↓', state.testEarthWeightN, 'N', 'earth'), fact('F · sign + upward', state.supportN, 'N', 'support'), fact('N ↑', state.contactLoadN, 'N', 'contact')],
      });
  }
  if (factor === 'pressure') {
    const earth = num(i.earthPressurePa), target = num(i.targetPressurePa);
    return view('Absolute pressure', 'What pressure step must the test cover?',
      'Two enclosures compare pressures. Inward arrows show compression normal to their faces; their length uses a common logarithmic scale.',
      'Set the chamber operating pressure and see how much it differs from the Earth environment. Δp between environments is not a computed load on a housing.',
      'Evaluating seals or stresses requires internal pressure, area and part geometry. Weight offloading does not resolve this difference.', {
        modelVisible: false, data: { earth, target, max: Math.max(earth || 0, target || 0, 1) },
        scale: 'Arrows: log(1 + p/1 Pa), same scale for both enclosures. 0 Pa: no arrows. They do not represent force in N.',
        sourceNote: manual ? 'Pressures from the manual lab.' : 'Earth: provider surface pressure and date in the mission. Moon: ideal 0 Pa; Mars: 636 Pa reference, no local measurement.',
        facts: [fact('Earth pressure', earth, 'Pa', 'earth'), fact('Target test pressure', target, 'Pa', 'target'), fact('Δp · Earth − target', calibration?.pressure?.differencePa, 'Pa', 'support'), fact('p target / p Earth', calibration?.pressure?.targetToEarthRatio, '', 'contact')],
        legend: [fact('Earth enclosure', earth, 'Pa', 'earth'), fact('Target enclosure', target, 'Pa', 'target')],
      });
  }
  if (factor === 'atmosphere') {
    const weather = e?.telemetry, speed = finite(weather?.values?.windSpeedMs) && weather.values.windSpeedMs >= 0 ? weather.values.windSpeedMs : null;
    const wind = windVector(speed, weather?.values?.windDirDeg);
    return view('Gas and atmospheric flow', 'Which gas environment does the analog still fail to reproduce?',
      'The compass shows Earth wind: the arrow points where it blows, on east/north axes. The enclosure represents the bench gas, with no invented particles.',
      'Orient a wind-exposure test and separate mobility from chamber tests. Wind speed is not equivalent to drag force.',
      'Extrapolating to the target requires its own composition, density, speed and flow regime. Thermal h is not derived from pressure or wind.', {
        data: { wind, speed },
        sourceNote: weather ? `Earth wind: ${weather.provider || 'provider'} · ${weather.live === true ? 'weather model' : 'archive'} · ${weather.observedAt || 'undated'}.` : 'No Earth wind available; its vector is removed.',
        scale: 'Direction is geographic; vector length is an orientation symbol, not a force or a speed scale.',
        facts: [fact('Earth wind', speed, 'm/s', 'gas'), fact('Wind direction · from', wind?.fromDeg, '°', 'gas'),
          fact('Earth gas · context', e?.environment?.atmosphere || 'No data'), fact('Target gas · context', t?.environment?.atmosphere || 'No data'), fact('Target density / drag', 'No data')],
        legend: [fact('Earth wind', speed, 'm/s', 'gas'), fact('Target flow', 'No vector available', '', 'target')],
      });
  }
  if (factor === 'temperature') {
    const temperatures = [num(i.surfaceK), num(i.airK), num(i.surroundingsK)], surface = t?.surfaceTemperature;
    const max = Math.max(500, ...temperatures.filter(finite), surface?.maxK || 0);
    return view('Three temperatures, three roles', 'What is known about the equipment, the gas and the radiative surroundings?',
      'Columns separate equipment Ts, gas Ta and radiative surroundings Tr. An empty column means pending data. The extra band belongs to the target ground.',
      'Prepare thermal test setpoints without confusing air, ground and equipment temperature. The terrain band helps choose conditions to study.',
      'Review the proposed baseline design or enter hypotheses in the lab. The surface range is not the rover’s certified operating range.', {
        data: { temperatures, max, surface }, scale: `Linear columns from 0 to ${inspectionValue(max, 'K')}. No vectors: temperature is a scalar, not a heat flow.`,
        sourceNote: `Target surface band: ${surface?.kind || 'unknown'} · ${surface?.source || 'no source'}. It does not refer to the equipment.`,
        facts: [fact('Ts · equipment surface', temperatures[0], 'K', 'heat'), fact('Ta · test gas', temperatures[1], 'K', 'gas'), fact('Tr · radiative surroundings', temperatures[2], 'K', 'target'), fact('Target ground · minimum', surface?.minK, 'K', 'target'), fact('Target ground · maximum', surface?.maxK, 'K', 'target')],
        legend: [fact('Equipment Ts', temperatures[0], 'K', 'heat'), fact('Gas Ta', temperatures[1], 'K', 'gas'), fact('Surroundings Tr', temperatures[2], 'K', 'target')],
      });
  }
  if (factor === 'heat-transfer') {
    const convection = num(calibration?.thermal?.convectionW), radiation = num(calibration?.thermal?.radiationW), max = Math.max(Math.abs(convection || 0), Math.abs(radiation || 0), 1);
    return view('Where heat enters or leaves', 'Which mechanism cools or heats the equipment on this bench?',
      'Blue: exchange with the gas. Orange: exchange with the radiative surroundings. Q > 0 leaves the equipment; Q < 0 enters. If Q = 0 there is no arrow; with no data no flow is drawn either.',
      'Identify which mechanism requires controlling the gas or the chamber walls. Compare magnitudes and spot heat gains before planning cooling.',
      'Fill in area, temperatures, h and emissivity, or explore the proposed baseline. Conduction, Sun, albedo, internal dissipation and transients are missing to close the balance.', {
        data: { convection, radiation, max }, scale: `Linear arrows on a common scale: maximum ${inspectionValue(max, 'W')}. Node positions are schematic.`,
        sourceNote: 'Qconv = h·A·(Ts − Ta). Qrad = ε·σ·A·(Ts⁴ − Tr⁴), grey surface and view factor 1. The gravity method does not change these Q values.',
        facts: [fact('Q convection · + loss', convection, 'W', 'gas'), fact('Q thermal radiation · + loss', radiation, 'W', 'heat'), fact('Exposed area', i.areaM2, 'm²'), fact('Gas h', i.hWm2K, 'W/m²/K'), fact('Emissivity ε', i.emissivity), fact('Ts / Ta / Tr', temperaturesText(i))],
        legend: [fact('Gas ↔ equipment', convection, 'W', 'gas'), fact('Surroundings ↔ equipment', radiation, 'W', 'heat')],
      });
  }
  if (factor === 'radiation') {
    const solar = num(e?.telemetry?.values?.solarRadiationWm2), reference = num(t?.environment?.solarConstantWm2);
    const earthDose = num(e?.ionizingDoseRate?.value), targetDose = num(t?.ionizingDoseRate?.value);
    return view('Solar energy and dose: separate channels', 'Which exposure can we compare and which must be measured?',
      'Bars compare the provider’s Earth irradiance with the target’s top-of-atmosphere solar reference. The separate dosimeter stays empty while there is no dose.',
      'Separate the solar load study from the shielding assessment. Irradiance in W/m² never validates protection against ionizing radiation.',
      'Measure dose and spectrum, and model shielding and geometry. The solar reference does not include shadow, local time, clouds or dust at the target site.', {
        modelVisible: false, data: { solar, reference, earthDose, targetDose, max: Math.max(solar || 0, reference || 0, 1) },
        scale: 'Linear irradiance bars on a common W/m² scale. There is no dose vector or measured solar direction in this view.',
        sourceNote: `Earth: ${e?.telemetry?.provider || 'no provider'} · ${e?.telemetry?.observedAt || 'undated'}. Target: scenario reference solar constant, not local irradiance.`,
        facts: [fact('Earth irradiance · provider', solar, 'W/m²', 'earth'), fact('Target solar reference · exoatmospheric', reference, 'W/m²', 'target'), fact('Earth ionizing dose', earthDose, 'Sv/s'), fact('Target ionizing dose', targetDose, 'Sv/s')],
        legend: [fact('Earth solar', solar, 'W/m²', 'earth'), fact('Target solar · reference', reference, 'W/m²', 'target'), fact('Dosimeter', targetDose, 'Sv/s')],
      });
  }
  if (factor === 'regolith') {
    return view('Known load, soil response pending', 'Which part of wheel–soil contact can we test?',
      'The green arrow shows the total normal reaction N under the equipment. The soil section is a schematic with no assigned properties. N is not split evenly across wheels.',
      'Set the static load for a contact test. Identify missing characterization before interpreting sinkage, traction or drilling.',
      'Measure grain size, cohesion, friction and compaction. Earth gravity acting on granular material does not change when the rover is offloaded.', {
        data: { max: forceReference(calibration) }, scale: 'Only N has a computed magnitude. No traction, sinkage, drill thrust or torque arrows: properties and tests are missing.',
        facts: [fact('N · total normal reaction', state.contactLoadN, 'N', 'contact'), fact('Tested equipment mass', state.testMassKg, 'kg', 'support'), fact('Cohesion / friction', 'No data'), fact('Grain size / compaction', 'No data'), fact('Traction / sinkage', 'Not computed')],
        legend: [fact('N ↑', state.contactLoadN, 'N', 'contact'), fact('Subsurface', 'Properties unmeasured')],
      });
  }
  if (factor === 'geometry') {
    const terrain = terrainPair(candidate, grids), geometry = compareTerrain(e, t);
    return view('Real relief at a shared scale', 'Does the analog offer comparable geometric obstacles?',
      'Two surfaces are sampled from the loaded DEMs. They share horizontal scale and vertical exaggeration; each height is measured from the minimum of its own window.',
      'Compare slopes, relief and TRI to choose test traverses. The index summarizes geometry; it does not include soil, gravity or environment.',
      'Inspect differences and resolution before transferring a route. This regional view does not identify wheel-sized rocks or steps.', {
        modelVisible: false, data: { terrain, geometry },
        scale: `Common window shown: ${inspectionValue(terrain.extent, 'm')}. Vertical exaggeration ×${inspectionValue(terrain.exaggeration)} on both DEMs. North: back; east: right. No force vectors.`,
        sourceNote: `${e?.grid?.dataset || 'Earth DEM pending'} ↔ ${t?.grid?.dataset || 'Target DEM pending'}. ${geometry.comparable ? '' : 'Insufficient resolution comparability; indicative result.'}`,
        facts: [fact('Geometric index · no physical threshold', geometry.index, '/100', 'contact'),
          ...['earth', 'target'].flatMap(side => [fact(`${side === 'earth' ? 'Earth' : 'Target'} · slope p90`, candidate?.[side]?.metrics?.slopeP90Deg, '°', side), fact(`${side === 'earth' ? 'Earth' : 'Target'} · relief p95−p5`, candidate?.[side]?.metrics?.reliefP95P5M, 'm', side)] )],
        legend: [fact('Earth DEM', terrain.surfaces[0] ? 'Real grid' : 'No grid', '', 'earth'), fact('Target DEM', terrain.surfaces[1] ? 'Real grid' : 'No grid', '', 'target')],
      });
  }
  return view('What detail size you can resolve', 'Does the grid allow inspecting the detail you care about?',
    'Both tiles show the processed grid spacing; the colored box marks one native pixel inside a common detail window. More interpolation does not add measurements.',
    'Decide whether the DEM works for regional relief or a finer survey is needed for wheels, cracks or drilling.',
    'Compare native resolution, spacing and extent. The NASA mesh is normalized and cannot be used to measure prototype dimensions.', {
      factor: 'scale', modelVisible: false, data: { earth: e?.grid, target: t?.grid },
      scale: 'Panels at a common metric scale; native pixel over the same detail window. No vectors: resolution and extent are lengths.',
      facts: ['earth', 'target'].flatMap(side => { const g = candidate?.[side]?.grid, label = side === 'earth' ? 'Earth' : 'Target'; return [fact(`${label} · native pixel`, g?.nativeResolutionMeters, 'm', side), fact(`${label} · processed spacing`, g?.spacingMeters, 'm', side), fact(`${label} · extent`, g?.extentMeters, 'm', side)]; }),
      legend: [fact('Earth native pixel', e?.grid?.nativeResolutionMeters, 'm', 'earth'), fact('Target native pixel', t?.grid?.nativeResolutionMeters, 'm', 'target')],
    });
}
function temperaturesText(i) { return [i.surfaceK, i.airK, i.surroundingsK].map(n => inspectionValue(n, 'K')).join(' / '); }
