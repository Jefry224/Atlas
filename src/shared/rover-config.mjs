// Única configuración didáctica de la simulación; no corresponde al modelo NASA.
export const ROVER_CONFIG = Object.freeze({ id: 'atlas-prototype-v1', source: 'prototype-config', massKg: 350,
  equipment: 'rover', wheelSupportedMassKg: null, drillMassKg: null,
  assumption: '350 kg teaching prototype; real Perseverance/Scarecrow mass is not inferred from their meshes. No per-wheel load split or drill mass.' });
