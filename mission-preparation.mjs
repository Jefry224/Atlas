// Product launch consent; the physics/controller remain usable independently.
export function preparationIdentity({ scenarioId, generation, body, plan, profile, fuelPercent }) {
  const zone = plan?.zones?.find(item => item.id === plan.selectedId);
  if (!scenarioId || !Number.isInteger(generation) || !plan?.grid || !plan.gridId || !profile
    || !zone || zone.eligible === false || zone.status === 'unevaluable'
    || !Number.isFinite(zone.x) || !Number.isFinite(zone.z)
    || !Number.isFinite(fuelPercent) || fuelPercent < 0 || fuelPercent > 100) return null;
  return Object.freeze({ scenarioId, generation, body, gridId: plan.gridId, profileId: profile.id,
    zoneId: zone.id, x: zone.x, z: zone.z, slopeDeg: zone.slopeDeg, reliefM: zone.reliefM,
    fuelPercent, propellantKg: profile.propellantKg * fuelPercent / 100,
    initialMassKg: profile.dryMassKg + profile.propellantKg * fuelPercent / 100 });
}

export function confirmPreparation(identity, { zoneReviewed = false, loadReviewed = false } = {}) {
  return identity && zoneReviewed && loadReviewed ? Object.freeze({ ...identity }) : null;
}

export function preparationMatches(confirmation, identity) {
  return Boolean(confirmation && identity && Object.keys(identity).every(key => Object.is(confirmation[key], identity[key])));
}
