/** Validate catalog sections before displaying them as site-specific evidence. */
export function assessCaveSections(data, expectedSiteId = 'la-corona') {
  if (data?.schema !== 'M4CaveSections' || data.version !== 1 ||
      data.kind !== 'digitized-literature-cross-sections' ||
      data.siteId !== expectedSiteId || data.catalogCode !== 'ES.LNZ.00' ||
      data.license !== 'CC BY 4.0' ||
      data.stationCoordinates !== null || data.roofDepthBySectionM !== null ||
      !Array.isArray(data.sections) || data.sections.length !== 74 ||
      data.sectionCount !== data.sections.length ||
      typeof data.source !== 'string' || !data.source.startsWith('https://zenodo.org/') ||
      typeof data.originalSurveyPaper !== 'string' || !data.originalSurveyPaper.startsWith('https://doi.org/')) {
    return { status: 'invalid', sections: [], summary: null };
  }
  for (const [index, section] of data.sections.entries()) {
    if (section?.number !== index + 1 ||
        ![section.widthM, section.heightM, section.areaM2].every(value => Number.isFinite(value) && value > 0) ||
        section.widthM >= 35 || section.heightM >= 35 ||
        section.areaM2 > section.widthM * section.heightM + 0.5 ||
        !Array.isArray(section.outlineM) || section.outlineM.length < 3 ||
        !section.outlineM.every(point => Array.isArray(point) && point.length === 2 &&
          point.every(Number.isFinite) && point[0] >= 0 && point[1] >= 0 &&
          point[0] <= section.widthM + 0.02 && point[1] <= section.heightM + 0.02)) {
      return { status: 'invalid', sections: [], summary: null };
    }
  }
  const ranges = key => {
    const sorted = data.sections.map(section => section[key]).sort((a, b) => a - b);
    const mid = sorted.length / 2;
    return { min: sorted[0], median: (sorted[mid - 1] + sorted[mid]) / 2, max: sorted.at(-1) };
  };
  return {
    status: 'ok', sections: data.sections,
    summary: { count: data.sectionCount, widthM: ranges('widthM'),
      heightM: ranges('heightM'), areaM2: ranges('areaM2') },
    source: data.source, originalSurveyPaper: data.originalSurveyPaper,
    credit: data.credit, license: data.license, caveats: data.caveats,
  };
}
