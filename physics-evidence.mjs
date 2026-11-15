// Presentation of existing model readings only; no new physical inference or certification.
const finite = Number.isFinite;
const stabilityLimit = 'Regional DEM/model tilt does not resolve wheel-scale obstacles, traction or centre-of-mass stability. This is not a local stability certification.';

export function regionalTiltSummary({ pitch, roll } = {}) {
  const pitchDeg = finite(pitch) ? pitch : null, rollDeg = finite(roll) ? roll : null;
  if (pitchDeg === null || rollDeg === null) {
    const reading = (name, value) => `${name}: ${value === null ? 'unavailable' : `${value.toFixed(1)}°`}`;
    return { title: 'Regional tilt unavailable', detail: `${reading('Pitch', pitchDeg)}; ${reading('roll', rollDeg)}. Both components are required for a combined tilt indication. ${stabilityLimit}`,
      tone: '', level: 'unknown', pitchDeg, rollDeg, maxTiltDeg: null };
  }
  const maxTiltDeg = Math.max(Math.abs(pitchDeg), Math.abs(rollDeg));
  const band = maxTiltDeg < 6 ? 'Low' : maxTiltDeg < 12 ? 'Moderate' : 'Elevated';
  return { title: `${band} regional tilt (${maxTiltDeg.toFixed(1)}°)`,
    detail: `Maximum absolute DEM/model pitch or roll; illustrative bands at 6° and 12°. ${stabilityLimit}`,
    tone: maxTiltDeg < 6 ? '' : 'warn', level: band.toLowerCase(), pitchDeg, rollDeg, maxTiltDeg };
}

function thermalReading(status) {
  const level = status?.level, marginK = status?.marginK;
  // Missing or inconsistent model output cannot establish a known operating state.
  const consistent = finite(marginK) && (level === 'nominal' && marginK >= 15
    || level === 'caution' && marginK >= 0 && marginK < 15 || level === 'critical' && marginK < 0);
  return consistent ? { level, marginK } : { level: 'unknown', marginK: null };
}

export function thermalPairSummary({ earthThermal, targetThermal } = {}) {
  const earth = thermalReading(earthThermal), target = thermalReading(targetThermal);
  const levels = [earth.level, target.level];
  const critical = levels.includes('critical'), caution = levels.includes('caution'), complete = !levels.includes('unknown');
  const describe = (name, reading) => reading.level === 'unknown' ? `${name}: thermal state unavailable.`
    : `${name}: ${reading.level === 'caution' ? 'near a model limit' : reading.level} (${reading.marginK.toFixed(1)} K model margin).`;
  const conclusion = critical ? 'At least one input is outside the illustrative operating range; review that input and the thermal assumptions.'
    : !complete ? 'At least one thermal state is unavailable; no joint nominal conclusion is supported.'
      : caution ? 'One or both inputs are near an illustrative operating limit; review the thermal assumptions.'
        : 'Both inputs are nominal within the illustrative model thresholds.';
  return { title: `Earth ${earth.level} · Target ${target.level}`,
    detail: `${describe('Earth', earth)} ${describe('Target', target)} ${conclusion} Earth air and target surface inputs are different source domains; this is not measured rover hardware temperature.`,
    tone: critical ? 'bad' : caution ? 'warn' : complete ? 'good' : '',
    level: critical ? 'critical' : caution ? 'caution' : complete ? 'nominal' : 'unknown', complete, earth, target };
}
