// Local evidence from checked-in terrain and explicitly archived telemetry; no fetch claims.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildCandidateAnalogPayload } from '../analog-audit.mjs';
import { automaticEngineering, createMissionRecorder } from '../mission-audit.mjs';
import { missionWorkbook, workbookBytes } from '../xlsx-report.mjs';
const root=new URL('../',import.meta.url), read=p=>JSON.parse(readFileSync(new URL(p,root)));
const dest=new URL('docs/evidencias/m2-excel-diseno/',root);mkdirSync(dest,{recursive:true});
const scenarios=read('assets/data/scenarios.json').scenarios, manifest=read('assets/data/nasa-assets.json');
const index=[];
for (const scenario of scenarios) {
  const telemetry=structuredClone(read('assets/data/telemetry-snapshot.json')[scenario.earthId]);
  // Explicit classification even if an archived file retains the old live flag.
  telemetry.provider='snapshot';telemetry.live=false;
  const candidate=buildCandidateAnalogPayload({scenario,earthGrid:read(scenario.earth),targetGrid:read(scenario.target),telemetry});
  const {audit}=automaticEngineering(candidate), recorder=createMissionRecorder();recorder.begin(scenario,'Example dossier: source archive; no invented SIM samples');recorder.weather(telemetry);
  const snapshot={candidate,audit,session:recorder.snapshot(),cutoffUTC:new Date().toISOString(),manifest};
  const name=`Atlas-M2-${scenario.id}-Mission-Control.xlsx`;writeFileSync(new URL(name,dest),missionWorkbook(snapshot));
  writeFileSync(new URL(`snapshot-${scenario.id}.json`,dest),JSON.stringify(snapshot,null,2)+'\n');
  index.push({scenario:scenario.id,file:name,source:'snapshot / archive',observedAt:telemetry.observedAt || 'No provista',roverSamples:0});
}
// Old snapshot, no profile or manifest, offline and partial sample: compatibility and absence reasons.
const scenario=scenarios[0],candidate=buildCandidateAnalogPayload({scenario,earthGrid:read(scenario.earth),targetGrid:read(scenario.target)}),{audit}=automaticEngineering(candidate);
const recorder=createMissionRecorder();recorder.begin(scenario,'Offline / partial QA');recorder.sample({elapsed:0,x:0,z:0,speed:0,battery:100},{});
const partial={candidate,audit,session:recorder.snapshot(),cutoffUTC:new Date().toISOString()};
writeFileSync(new URL('Atlas-M2-offline-parcial.xlsx',dest),missionWorkbook(partial));
writeFileSync(new URL('snapshot-offline-parcial.json',dest),JSON.stringify(partial,null,2)+'\n');
writeFileSync(new URL('strings-seguras.xlsx',dest),workbookBytes([{name:'Prueba',rows:[['Texto','Número'],['=HYPERLINK("evil")',42],['+cmd',null],['@SUM(A1)',-3],['-malicioso','Luna 🌙\u0001 & < >']]}]));
writeFileSync(new URL('examples.json',dest),JSON.stringify(index,null,2)+'\n');console.log(index);
