import { validGrid, gridExtent } from '../shared/mission-math.mjs';
import { demIdentity } from './earth-expedition.mjs';

export function earthAnalysisInput({site,grid,reference,targetGrid=null,sessionId=null,telemetry=null}) {
  if(!site?.id||!reference?.id||!['moon','mars'].includes(reference.body))return null;
  if(!validGrid(grid)||(grid.id||grid.site)!==site.id||(grid.body&&grid.body!=='earth'))return null;
  const target=validGrid(targetGrid)&&targetGrid.id===reference.targetId&&targetGrid.body===reference.body?targetGrid:null;
  const analysisContext={domain:'earth-field-test',earthSiteId:site.id,expeditionSessionId:sessionId,demIdentity:demIdentity(grid),referenceScenarioId:reference.id,referenceTargetId:reference.targetId,referenceBody:reference.body};
  return {
    scenario:{...reference,earthId:site.id,earthLabel:site.name,title:`${site.name} · test against ${reference.targetLabel||reference.targetId}`},
    earthGrid:{...grid,id:site.id,body:'earth',name:grid.name||site.name,extentMeters:gridExtent(grid)},targetGrid:target,
    telemetry:telemetry?.site===site.id?telemetry:null,analysisContext,
    scopeKey:`earth:${site.id}:${sessionId||'loading'}:${demIdentity(grid)}:${reference.id}:${reference.body}:${reference.targetId}`,
  };
}
