// Resolve the authoritative Earth identity without changing catalogue selection or any run session.
export function earthExportIdentity({ view, scenario, grid, selectedSite, catalogueSite = null }) {
  const id = view === 'split' ? scenario?.earthId : selectedSite?.id;
  if (!id) return null;
  const center = Array.isArray(grid?.center) && grid.center.length === 2 && grid.center.every(Number.isFinite) ? grid.center : null;
  const reference = catalogueSite?.id === id && Number.isFinite(catalogueSite.lat) && Number.isFinite(catalogueSite.lon)
    ? { lat: catalogueSite.lat, lon: catalogueSite.lon } : null;
  return { id, name: view === 'split' ? grid?.name || scenario?.earthLabel || selectedSite?.name || id : selectedSite?.name || grid?.name || id,
    country: catalogueSite?.id === id ? catalogueSite.country || null : null,
    lat: center?.[0] ?? reference?.lat ?? null, lon: center?.[1] ?? reference?.lon ?? null,
    coordinateRole: center ? 'DEM window centre; catalogue reference retained separately' : 'DEM georeference unavailable; catalogue reference if known',
    catalogueReference: reference };
}
