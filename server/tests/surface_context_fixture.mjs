import { assessSurface, compactSurface } from '../../src/mission/surface-assessment.mjs';
import { automaticSurface } from '../../src/mission/surface-evidence.mjs';
const context = { key: 'destination:moon:marius-hills:session:dem', siteId: 'marius-hills', body: 'moon', sessionId: 'surface-fixture-session', grid: { nativeResolutionMeters: 33.02, spacingMeters: 37.5 } };
const report = process.argv.includes('--automatic') ? automaticSurface(context,{id:'marius-hills',body:'moon',gridSize:3,spacingMeters:37.5,nativeResolutionMeters:33.02,elevation:[0,1,2,1,2,3,2,3,4],source:'https://example.test/dem',dataset:'QA DEM'}) : assessSurface(context,
  { lengthM: 1, widthM: .8, heightM: .5, uncertaintyPct: 20, densityMinKgM3: 2600, densityMaxKgM3: 3200, clearanceM: .3 },
  { lengthM: 55, widthM: 49, depthM: 40, uncertaintyPct: null }, 'lroc-marius-pit');
console.log(JSON.stringify(compactSurface(report,2)));
