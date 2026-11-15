// Pure, deliberately compact context for the AI dossier endpoint.
// Raw elevation arrays and imagery never belong in a language-model request.

function gridSummary(grid) {
  if (!grid || typeof grid !== 'object') return null;
  return {
    id: grid.id ?? null,
    name: grid.name ?? null,
    body: grid.body ?? null,
    center: Array.isArray(grid.center) ? grid.center : null,
    dataset: grid.dataset ?? null,
    nativeResolutionMeters: grid.nativeResolutionMeters ?? null,
    source: grid.source ?? null,
    fetchedAt: grid.fetchedAt ?? null,
    metrics: grid.metrics ?? null,
    thermal: grid.thermal ?? null,
    environment: grid.environment ?? null,
    provenance: Array.isArray(grid.provenance) ? grid.provenance : [],
    notes: Array.isArray(grid.notes) ? grid.notes : [],
  };
}

function auditSummary(audit) {
  if (!audit || typeof audit !== 'object') return null;
  return {
    version: audit.version ?? null,
    valid: audit.valid ?? null,
    counts: audit.counts ?? null,
    matrix: Array.isArray(audit.matrix) ? audit.matrix.map(({ id, label, status, strength, breakdown, action }) => ({ id, label, status, strength, breakdown, action })) : [],
    calibration: audit.calibration ?? null,
    limitations: Array.isArray(audit.limitations) ? audit.limitations : [],
  };
}

export function buildDossierContext({ scenario, earthGrid, targetGrid, telemetry = null, forecast = null, analogyAudit = null, processes = null }) {
  return {
    scenario: scenario ? {
      id: scenario.id ?? null,
      title: scenario.title ?? null,
      focus: scenario.focus ?? null,
      body: scenario.body ?? null,
      earthId: scenario.earthId ?? null,
      targetId: scenario.targetId ?? null,
    } : null,
    earth: gridSummary(earthGrid),
    target: gridSummary(targetGrid),
    telemetry: telemetry ? {
      provider: telemetry.provider ?? null,
      live: telemetry.live ?? null,
      observedAt: telemetry.observedAt ?? null,
      fetchedAt: telemetry.fetchedAt ?? null,
      values: telemetry.values ?? null,
      source: telemetry.source ?? null,
    } : null,
    forecast: forecast ? {
      provider: forecast.provider ?? null,
      live: forecast.live ?? null,
      fetchedAt: forecast.fetchedAt ?? null,
      source: forecast.source ?? null,
      hours: Array.isArray(forecast.hours) ? forecast.hours.slice(0, 72) : [],
    } : null,
    analogyAudit: auditSummary(analogyAudit),
    processes,
    hazards: null,
    unavailableModules: [
      ...(analogyAudit ? [] : ['Analogy audit results are unavailable.']),
      ...(processes ? [] : ['Processed dynamic-process windows are unavailable.']),
      'Module 4 subsurface and hazard analysis is unavailable.',
    ],
  };
}
