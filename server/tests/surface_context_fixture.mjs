import { assessSurface, compactSurface } from '../../src/mission/surface-assessment.mjs';
const context = { key: 'destination:moon:marius-hills:session:dem', siteId: 'marius-hills', body: 'moon', sessionId: 'surface-fixture-session', grid: { nativeResolutionMeters: 33.02, spacingMeters: 37.5 } };
console.log(JSON.stringify(compactSurface(assessSurface(context,
  { lengthM: 1, widthM: .8, heightM: .5, uncertaintyPct: 20, densityMinKgM3: 2600, densityMaxKgM3: 3200, clearanceM: .3 },
  { lengthM: 55, widthM: 49, depthM: 40, uncertaintyPct: null }, 'lroc-marius-pit'), 2)));
