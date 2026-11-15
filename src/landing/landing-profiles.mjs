import { BODY_ENV } from '../shared/sim-physics.mjs';
import { ROVER_CONFIG } from '../shared/rover-config.mjs';

export const LANDING_PROFILE_VERSION = '1.0.0';
const finite = Number.isFinite;
const copy = value => JSON.parse(JSON.stringify(value));
const common = {
  schema: 'LandingProfile', version: LANDING_PROFILE_VERSION, kind: 'proposed-design',
  payloadKg: ROVER_CONFIG.massKg, landerDryMassKg: 500, dryMassKg: ROVER_CONFIG.massKg + 500,
  ispSeconds: 305, g0Ms2: 9.80665, tiltMaxDeg: 15,
  startAltitudeM: 180, startVerticalSpeedMs: -6, startOffsetXM: 60, startOffsetZM: -45,
  maxDescentSpeedMs: 12, finalDescentSpeedMs: 0.6,
  maxAccelerationMs2: 3, brakingAccelerationMs2: 1.5, lateralAccelerationMs2: 2,
  touchdownVerticalSpeedMs: 1.2, touchdownHorizontalSpeedMs: 0.8,
  touchdownTiltDeg: 8, touchdownPositionErrorM: 12,
  maxRegionalSlopeDeg: 12, maxRegionalReliefM: 70,
  regionalRadiusCells: 3, nominalScienceSeparationM: 300,
  maxNativeResolutionRatio: 2, maxSimSeconds: 180,
  assumptions: {
    propulsion: 'Ideal throttleable thrust 0..max; constant Isp, no ambient nozzle correction.',
    navigation: 'State and DEM known exactly; idealized control, no sensors or TRN implemented.',
    atmosphere: 'No drag, wind, lift or pressure in the motion model.',
    attitude: 'Bounded thrust vector; instantaneous attitude, no rotational dynamics or landing legs.',
    payload: `${ROVER_CONFIG.massKg} kg rover payload from ROVER_CONFIG plus a proposed 500 kg dry lander; not the total lander mass.`,
  },
  sources: [
    { label: 'NASA Glenn · Specific Impulse', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/', role: 'Isp = T/(mass flow · g0); does not validate this design.', accessedOn: '2026-11-14' },
    { label: 'NASA · SPLICE', url: 'https://www.nasa.gov/safe-and-precise-landing-integrated-capabilities-evolution-splice/', role: 'Conceptual navigation inspiration; sensors/algorithms not implemented.', accessedOn: '2026-11-14' },
  ],
  limitations: [
    'Proposed design for virtual comparison; masses, engine, fuel and tolerances are not real mission requirements.',
    'Final powered descent only: no orbit, entry, parachutes or full EDL.',
    'The DEM only allows regional assessment; it does not resolve landing legs, rocks, dust or pit/cave geometry.',
    'Touchdown within model tolerances does not certify terrain safety.',
    'The comparison uses body-adapted configurations (different fuel and thrust); it does not isolate gravity as the only variable.',
  ],
};
const bodySettings = {
  earth: { propellantKg: 650, thrustMaxN: 22000, label: 'Earth · virtual comparison',
    limitation: 'Earth is a virtual comparison without aerodynamics, not a physical Earth test.' },
  moon: { propellantKg: 180, thrustMaxN: 6000, label: 'Moon · idealized final descent',
    limitation: 'Ideal lunar vacuum: plume interaction, regolith and shadows for navigation are not modeled.' },
  mars: { propellantKg: 260, thrustMaxN: 10000, label: 'Mars · final powered segment',
    limitation: 'Mars omits atmosphere and wind in this idealized segment; it does not reproduce Martian entry, parachutes or EDL.' },
};

/** Isolated, editable copy; unsupported body IDs fail explicitly. All numeric quantities are SI. */
export function getLandingProfile(body) {
  if (!Object.hasOwn(bodySettings, body)) throw new RangeError(`Unsupported landing body: ${String(body)}`);
  const { limitation, ...settings } = bodySettings[body];
  return copy({ ...common, ...settings, id: `atlas-final-${body}-v1`, body,
    gravityMs2: BODY_ENV[body].gravityMs2,
    limitations: [...common.limitations, limitation] });
}

/** Returns errors rather than coercing missing/null/invalid scientific quantities. */
export function validateLandingProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return { valid: false, errors: ['profile: object required'] };
  if (profile.schema !== 'LandingProfile' || profile.version !== LANDING_PROFILE_VERSION) errors.push('schema/version: LandingProfile 1.0.0 required');
  if (typeof profile.id !== 'string' || !profile.id.trim()) errors.push('id: required');
  if (!Object.hasOwn(BODY_ENV, profile.body)) errors.push('body: earth/moon/mars required');
  else if (profile.gravityMs2 !== BODY_ENV[profile.body].gravityMs2) errors.push('gravityMs2: must match BODY_ENV');
  if (Object.hasOwn(BODY_ENV, profile.body) && profile.id !== `atlas-final-${profile.body}-v1`) errors.push('id: profile not supported for this body/version');
  const ranges = {
    dryMassKg: [1, 1e6], payloadKg: [0, 1e6], landerDryMassKg: [1, 1e6],
    propellantKg: [0, 1e6], ispSeconds: [1, 1000], g0Ms2: [9.80665, 9.80665],
    thrustMaxN: [0, 1e8], tiltMaxDeg: [0, 45], startAltitudeM: [0.1, 5000],
    startVerticalSpeedMs: [-200, 0], startOffsetXM: [-5000, 5000], startOffsetZM: [-5000, 5000],
    maxDescentSpeedMs: [0.1, 200], finalDescentSpeedMs: [0.05, 5],
    maxAccelerationMs2: [0.01, 50], brakingAccelerationMs2: [0.01, 50], lateralAccelerationMs2: [0.01, 50],
    touchdownVerticalSpeedMs: [0.05, 10], touchdownHorizontalSpeedMs: [0.01, 10],
    touchdownTiltDeg: [0, 45], touchdownPositionErrorM: [0.01, 100],
    maxRegionalSlopeDeg: [0.1, 30], maxRegionalReliefM: [0.1, 500],
    regionalRadiusCells: [3, 8], nominalScienceSeparationM: [1, 5000],
    maxNativeResolutionRatio: [1, 2], maxSimSeconds: [1, 1800],
  };
  for (const [key, [low, high]] of Object.entries(ranges)) {
    if (!finite(profile[key]) || profile[key] < low || profile[key] > high) errors.push(`${key}: outside SI range [${low},${high}]`);
  }
  if (!Number.isInteger(profile.regionalRadiusCells)) errors.push('regionalRadiusCells: integer required');
  if (profile.dryMassKg !== profile.payloadKg + profile.landerDryMassKg) errors.push('dryMassKg: must equal payloadKg + landerDryMassKg');
  if (profile.finalDescentSpeedMs > profile.touchdownVerticalSpeedMs || profile.finalDescentSpeedMs > profile.maxDescentSpeedMs) errors.push('finalDescentSpeedMs: incompatible with tolerance/max speed');
  if (!Array.isArray(profile.limitations) || !profile.limitations.length || !profile.limitations.every(s => typeof s === 'string')) errors.push('limitations: list of strings required');
  if (profile.kind !== 'proposed-design') errors.push('kind: proposed-design required');
  return { valid: errors.length === 0, errors };
}
