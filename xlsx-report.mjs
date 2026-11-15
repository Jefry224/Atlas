// Escritor OOXML local, ZIP STORE + CRC32; sin fórmulas, macros, red ni dependencias.
import { captureLanding, LANDING_SCOPE } from './landing-report.mjs';
import { ROVER_CONFIG } from './rover-config.mjs';
import { LIMITS, SOURCES } from './analog-audit.mjs';
import { missionDesignEngineering } from './mission-audit.mjs';
import { getMissionBaseProfile, validateMissionBaseProfile } from './mission-profiles.mjs';
const enc = new TextEncoder();
const xml = s => String(s ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const col = n => { let s=''; for(n++;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; };
const crc32 = bytes => { let c=0xffffffff; for(const b of bytes){c^=b; for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0);} return (c^0xffffffff)>>>0; };
export function zipStore(files) {
  const chunks=[], central=[]; let offset=0, size=0;
  const header = n => { const bytes=new Uint8Array(n); return { bytes, v:new DataView(bytes.buffer) }; };
  for(const [name, text] of files){ const path=enc.encode(name), data=enc.encode(text), crc=crc32(data), h=header(30); h.v.setUint32(0,0x04034b50,true); h.v.setUint16(4,20,true); h.v.setUint16(6,0x800,true); h.v.setUint32(14,crc,true); h.v.setUint32(18,data.length,true); h.v.setUint32(22,data.length,true); h.v.setUint16(26,path.length,true); chunks.push(h.bytes,path,data);
    const c=header(46); c.v.setUint32(0,0x02014b50,true); c.v.setUint16(4,20,true); c.v.setUint16(6,20,true); c.v.setUint16(8,0x800,true); c.v.setUint32(16,crc,true); c.v.setUint32(20,data.length,true); c.v.setUint32(24,data.length,true); c.v.setUint16(28,path.length,true); c.v.setUint32(42,offset,true); central.push(c.bytes,path); size+=46+path.length; offset+=30+path.length+data.length;
  }
  const end=header(22); end.v.setUint32(0,0x06054b50,true); end.v.setUint16(8,files.length,true); end.v.setUint16(10,files.length,true); end.v.setUint32(12,size,true); end.v.setUint32(16,offset,true);
  const all=[...chunks,...central,end.bytes], out=new Uint8Array(all.reduce((s,b)=>s+b.length,0)); let i=0; for(const b of all){out.set(b,i);i+=b.length;} return out;
}
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const COLORS = { navy:'07173F', blue:'0042A6', cyan:'2E96F5', acid:'EAFE07', ink:'172B4D', pale:'EFF5FC', line:'CDDAEB', muted:'50617E' };
const missing = reason => `Pending: ${reason}`;
const present = (value, reason = 'not recorded at cutoff; no reading is invented') => {
  if (value === null || value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return missing(reason);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') throw new Error('Represent objects as broken-down rows, not JSON');
  return value;
};
const observed = q => q?.observedAt || (['reference','prototype-design','derived-design','mission-config','diviner','idealization'].includes(q?.kind) ? 'Design basis: no observation date' : 'No observation date: check source');
function leaves(value, path = '') {
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k,v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, present(value, 'field not provided by the original source')]];
}
function humanEvidence(evidence) {
  return (evidence || []).flatMap(e => leaves(e.data, e.path)).map(([p,v]) => `${p}: ${v}`).join('\n') || 'No evidence attached: see the procedure';
}
const stylesXML = () => `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS}">
<numFmts count="5"><numFmt numFmtId="164" formatCode="0.00;[Red](0.00);0.00"/><numFmt numFmtId="165" formatCode="0.0000;[Red](0.0000);0.0000"/><numFmt numFmtId="166" formatCode="0.00E+00"/><numFmt numFmtId="167" formatCode="0;[Red](0);0"/><numFmt numFmtId="168" formatCode="0.000000;[Red](0.000000);0.000000"/></numFmts>
<fonts count="7"><font><sz val="11"/><color rgb="FF${COLORS.ink}"/><name val="Calibri"/></font><font><b/><sz val="26"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF${COLORS.navy}"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF${COLORS.muted}"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF${COLORS.ink}"/><name val="Consolas"/></font><font><b/><sz val="20"/><color rgb="FF${COLORS.navy}"/><name val="Calibri"/></font></fonts>
<fills count="10"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${[COLORS.navy,COLORS.blue,COLORS.acid,COLORS.pale,'FFFFFF','DCF3E9','FFF0CF','FFE2E5'].map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="hair"><color rgb="FF${COLORS.line}"/></left><right style="hair"><color rgb="FF${COLORS.line}"/></right><top/><bottom style="hair"><color rgb="FF${COLORS.line}"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="20">${[
[0,0,0,0],[0,1,2,0],[0,2,3,0],[0,3,4,0],[0,2,2,1],[0,0,6,1],[0,0,5,1],[164,5,6,1],[164,5,5,1],[0,4,6,0],[0,3,7,1],[0,3,8,1],[0,6,4,0],[165,5,6,1],[165,5,5,1],[166,5,6,1],[166,5,5,1],[0,3,9,1],[168,5,6,1],[168,5,5,1]
].map(([n,f,fill,b])=>`<xf numFmtId="${n}" fontId="${f}" fillId="${fill}" borderId="${b}" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment vertical="center" wrapText="1"${f===5?' horizontal="right" indent="1"':''}/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
const textCell = (ref,value,style) => typeof value === 'number' && Number.isFinite(value)
  ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
  : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(present(value))}</t></is></c>`;
function rowHeight(row, widths, min = 30) {
  const lines = Math.max(...row.map((v,j) => String(v).split('\n').reduce((n,s)=>n+Math.max(1,Math.ceil([...s].length/Math.max(8,(widths[j] || 28)-3))),0)));
  return Math.min(409, Math.max(min, lines*15+14));
}
function chartXML() {
  const s = (title, c, color) => `<c:ser><c:idx val="${c-1}"/><c:order val="${c-1}"/><c:tx><c:v>${title}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>'Summary'!$A$25:$A$26</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>'Summary'!$${col(c)}$25:$${col(c)}$26</c:f></c:numRef></c:val></c:ser>`;
  return `<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:lang val="en-US"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1400"/><a:t>Static load and vertical support (N)</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="stacked"/>${s('Ground load',1,COLORS.blue)}${s('Vertical support',2,COLORS.cyan)}<c:gapWidth val="100"/><c:axId val="1"/><c:axId val="2"/></c:barChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="1"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
}
export function workbookBytes(sheets) {
  const hasChart = sheets.some(s=>s.chart);
  const files=[['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hasChart?'<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':''}${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
  ['_rels/.rels',`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/styles.xml',stylesXML()],
  ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><definedNames>${sheets.map((s,i)=>`<definedName name="_xlnm.Print_Area" localSheetId="${i}">'${xml(s.name)}'!$A$1:$${col(Math.max(...s.rows.map(r=>r.length))-1)}$${s.rows.length}</definedName>${s.headerRow?`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${xml(s.name)}'!$${s.headerRow}:$${s.headerRow}</definedName>`:''}`).join('')}</definedNames></workbook>`],
  ['xl/_rels/workbook.xml.rels',`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${REL}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="${REL}/styles" Target="styles.xml"/></Relationships>`]];
  sheets.forEach((s,i)=>{
    const width=Math.max(1,...s.rows.map(r=>r.length)), last=col(width-1), header=s.headerRow ?? 1, cover=!!s.cover;
    const widths=s.widths || Array(width).fill(30), merges=s.merges || [], mergedAt=new Map();
    for(const ref of merges) {const [start,end]=ref.split(':'); const m=start.match(/([A-Z]+)(\d+)/), n=end.match(/([A-Z]+)(\d+)/); const number=x=>[...x].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1; for(let r=+m[2];r<=+n[2];r++)for(let c=number(m[1]);c<=number(n[1]);c++)if(`${col(c)}${r}`!==start)mergedAt.set(`${col(c)}${r}`,true);}
    const rows=s.rows.map((r,k)=>{
      const rn=k+1, special=s.rowStyles?.[rn]; const height=s.heights?.[rn] || (rn===1?48:rn===2?38:rn===3?28:!cover&&rn===header?36:rowHeight(r,widths));
      return `<row r="${rn}" ht="${height}" customHeight="1">${Array.from({length:width},(_,j)=>{
        const ref=`${col(j)}${rn}`; if(mergedAt.has(ref))return '';
        let value=r[j]; if(value===undefined&&cover) return ''; value=present(value);
        const numeric=typeof value==='number', odd=(rn-header)%2===0;
        const unit = s.name==='Tools'?r[4]:['Thermal','Calibration','Data_and_origin'].includes(s.name)?r[3]:null;
        const precise = unit ? ['1','m','m²','rad','°'].includes(unit) : /Lat|Lon/.test(s.rows[header-1]?.[j] || '');
        let style=special ?? (rn===1?1:rn===2?2:rn===3?3:!cover&&rn===header?4:numeric?(Math.abs(value)>0&&Math.abs(value)<0.0001?(odd?16:15):precise?(odd?14:13):(odd?8:7)):(odd?6:5));
        if(numeric && rn>header && (s.name==='Descent' && /Own georeference|Isp g0 reference/.test(r[1]) || s.name==='Test_zone' && /center|pose.latitude|pose.longitude/.test(r[1]))) style=odd?19:18;
        if(!special && rn>header && /^(Valid|valid$|proposed-design$|Complete$)/.test(String(value)))style=10;
        if(!special && rn>header && /^(Pending:|Partial|partial$|unknown$)/.test(String(value)))style=11;
        if(!special && rn>header && /^(Breakdown|breakdown$)/.test(String(value)))style=17;
        return textCell(ref,value,style);
      }).join('')}</row>`;
    }).join('');
    const freeze=cover?'':`<pane ySplit="${header}" topLeftCell="A${header+1}" activePane="bottomLeft" state="frozen"/>`;
    const hyperlinks=(s.links || (s.headerRow ? [{ref:'A3',target:'Summary'}] : [])).map(l=>`<hyperlink ref="${l.ref}" location="&apos;${xml(l.target)}&apos;!A1" display="${xml(l.target)}"/>`).join('');
    files.push([`xl/worksheets/sheet${i+1}.xml`,`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetPr><tabColor rgb="FF${s.tabColor||COLORS.blue}"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${s.rows.length}"/><sheetViews><sheetView showGridLines="0" zoomScale="80" workbookViewId="0">${freeze}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols>${widths.map((w,j)=>`<col min="${j+1}" max="${j+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${!cover?`<autoFilter ref="A${header}:${last}${s.rows.length}"/>`:''}${merges.length?`<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:''}${hyperlinks?`<hyperlinks>${hyperlinks}</hyperlinks>`:''}<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.15" footer="0.2"/><pageSetup paperSize="${cover?9:8}" orientation="${cover?'portrait':'landscape'}" fitToWidth="1" fitToHeight="${cover?1:0}"/><headerFooter><oddFooter>&amp;LAtlas · M2 / ${xml(s.name)}&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>${s.chart?'<drawing r:id="drawing"/>':''}</worksheet>`]);
    if(s.chart)files.push([`xl/worksheets/_rels/sheet${i+1}.xml.rels`,`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="drawing" Type="${REL}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`]);
  });
  if(hasChart)files.push(['xl/charts/chart1.xml',chartXML()],['xl/drawings/drawing1.xml',`<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>27</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>40</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Static load comparison"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${REL}" r:id="chart"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`],['xl/drawings/_rels/drawing1.xml.rels',`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="chart" Type="${REL}/chart" Target="../charts/chart1.xml"/></Relationships>`]);
  return zipStore(files);
}
export function missionSheets(snapshot) {
  const { candidate:c, audit:a, session:s, cutoffUTC, manifest={} }=snapshot;
  let landing = snapshot.landing ?? s.landing ?? null;
  if (snapshot.landing && s.landing && JSON.stringify(snapshot.landing)!==JSON.stringify(s.landing)) throw new Error('Incompatible descent: two different captures at cutoff');
  if (landing) {
    const result=captureLanding(landing,{missionId:s.id,scenarioId:c.scenario.id,body:c.scenario.body,earthId:c.scenario.earthId,targetId:c.scenario.targetId,startedAt:s.startedAt});
    if (!result.valid) throw new Error(`Incompatible descent: ${result.errors.join('; ')}`);
    landing=result.value;
  }
  const profile=snapshot.baseProfile || getMissionBaseProfile(c.scenario);
  const valid=validateMissionBaseProfile(profile);
  if(!valid.valid || profile.scenarioId!==c.scenario.id)throw new Error(`Incompatible base profile: ${valid.errors.join('; ')}`);
  const design=missionDesignEngineering(c,profile), cal=a.calibration, g=cal.gravity, sheets=[];
  const title=c.scenario.title, sourceState=s.weatherState || (c.earth.telemetry?.provider==='snapshot'?'archive':'No observation available');
  const add=(name,section,description,header,rows,widths,tabColor=COLORS.blue)=>{
    const w=header.length, last=col(w-1);
    sheets.push({name,headerRow:6,widths,tabColor,rows:[[`S.E.L.E.N.E / ATLAS   ·   ${section}`],[`${name.replaceAll('_',' ')}  /  ${title}`],['← Summary',`M2 / ${c.scenario.id}`,'UTC and SIM kept separate · Atlas / Mission Control'],[description],[`UTC cutoff ${cutoffUTC} · Profile ${profile.version} revised ${profile.revisionDate} · Design basis ≠ measurement`],header,...rows.map(row=>header.map((_,j)=>present(row[j])))],merges:[`A1:${last}1`,`A2:${last}2`,`C3:${last}3`,`A4:${last}4`,`A5:${last}5`],heights:{4:44,5:34}});
  };
  const coverRows=[
    ['S.E.L.E.N.E / ATLAS'], ['MODULE 02   /   MISSION CONTROL'],
    ['Mission →','Tools →','Thermal →','Calibration →','Sources →','History →'],
    ['MISSION DOSSIER'],[`${title}  ·  ${c.earth.name} ↔ ${c.target.name}\n${c.scenario.focus || profile.purpose}`],
    ['01 / STATE AND PROVENANCE'],[`${sourceState}  ·  ${c.earth.telemetry?.provider || 'no observed provider'}  ·  Rover: simulation`],
    [`Weather observation: ${c.earth.telemetry?.observedAt || 'not recorded; see Data and origin'}`],
    ['02 / STATIC TEST INDICATORS'],
    ['PROTOTYPE MASS','STRUCTURAL','TARGET WEIGHT','REFERENCE','VERTICAL SUPPORT','MODEL'],
    [ROVER_CONFIG.massKg,'kg',g.targetWeightN,'N',g.offloadForceN,'N'],
    ['BASE TOOLS','PROPOSED DESIGN','ROVER SAMPLES','SIMULATION','WEATHER OBSERVATIONS','PROVIDER'],
    [profile.tools.length,'no physical connection',s.rover.length,'session log',s.weather.length,sourceState],
    ['03 / CUTOFF AND SCOPE'],[`UTC cutoff: ${cutoffUTC} · UTC start: ${s.startedAt}`],[`Session state: ${s.endedAt || 'In progress'} · ID: ${s.id}`],
    ['Exploratory audit: does not certify GO/NO-GO. Baselines are not stored as readings in the history.'],
    ['04 / DESIGN BASE PROFILE'],[`${profile.title} · v${profile.version} · revision ${profile.revisionDate}`],
    [`${profile.purpose}\n${profile.assumptions[0]}`],
    ['LEGEND / READ BEFORE COMPARING'],['Measurement: identified sensor only · Model: calculation or provider weather\nReference: documentary source / archive · Proposed basis: design setpoint or equipment, no physical validation'],
    ['05 / NATIVE COMPARISON · LOADS IN NEWTONS'],
    ['Test mode','Ground load (N)','Support (N)','Test mass (kg)','Total vertical (N)','Scope'],
    ['offload',g.targetWeightN,g.offloadForceN,cal.inputs.massKg,g.earthWeightN,'Same mass; quasi-static support'],
    ['equivalent',g.targetWeightN,0,g.equivalentEarthMassKg,g.targetWeightN,'Reduced mass; different inertia'],
    ['Ground load matches in both modes; the support and the test mass change.'],
    ...Array.from({length:13},()=>[]),
    ['LOCAL FILE · No macros or cell formulas · Sources and limits traceable in every section']
  ];
  if (landing) coverRows[16] = [`DESCENT / ${landing.phase} · Primary target: ${landing.runs.target?.phase || 'unavailable'} · Earth: ${landing.missionMode==='target-first' ? 'Not applicable: no Earth descent' : landing.runs.earth?.phase || 'unavailable'}. Simulated contact; no certification. See Descent / Trajectory / Test_zone.`];
  const coverMerges=[1,2,4,5,6,7,8,9,14,15,16,17,18,19,20,21,22,23,27,41].map(r=>`A${r}:F${r}`);
  sheets.push({name:'Summary',cover:true,chart:true,rows:coverRows,widths:[25,22,23,22,23,26],merges:coverMerges,links:['Mission','Tools','Thermal','Calibration','Sources','Rover_history'].map((target,i)=>({ref:`${col(i)}3`,target})),rowStyles:{1:1,2:2,4:3,6:4,9:4,10:9,11:12,12:9,13:3,14:4,18:4,21:4,23:4,24:4,41:9},heights:{1:48,2:32,3:26,4:25,5:58,6:25,7:30,8:28,9:25,10:30,11:40,12:34,13:34,14:25,15:32,16:32,17:landing?65:35,18:25,19:32,20:62,21:25,22:60,23:25,24:42,25:40,26:40,27:38,...Object.fromEntries(Array.from({length:13},(_,i)=>[i+28,19])),41:28},tabColor:COLORS.acid});
  add('Mission','01 / CONTEXT','Scenario and presentation with full paths. NASA meshes are visual: their physical units are not inferred from on-screen scale.',
    ['Field / path','Current available value','Type / origin','Limit / interpretation'],[
      ...leaves(c.scenario).map(([k,v])=>[k,v,'scenario','Scenario configuration; no mission certification']),
      ['Base profile',profile.id,profile.source,`${profile.kind} · revision ${profile.revisionDate}; not an observation`],
      ...leaves(snapshot.visualPresentation || {state:'No visual presentation attached'}).map(([k,v])=>[`visual.${k}`,v,'presentation','Visual scale; physical units not verified']),
      ...leaves(s.latest || {state:'Session started; no simulation samples yet'}).map(([k,v])=>[`rover.current.${k}`,v,'sim','Last sync before cutoff; not a physical reading']),
      ...['earth','target'].flatMap(side=>[['Site '+side,c[side].name,c[side].id,'Scenario location'],...leaves(c[side].center,'coordenadas').map(([k,v])=>[`${side}.${k}`,v,'degrees','Latitude/longitude of the regional center']),...leaves(c[side].grid || {state:'Visual context without attached DEM'}).map(([k,v])=>[`${side}.grid.${k}`,v,'DEM file','Regional scale; does not validate normalized mesh geometry'])])
    ],[35,58,34,56]);
  add('Data_and_origin','02 / TRACEABILITY','The current column keeps the real source. The design basis is a proposed setpoint and never replaces a missing observation.',
    ['Variable','Design basis value','Current available value','Unit','Current / base type','Current source','UTC observation','Base source / revision','State / limit'],Object.entries(cal.origins).map(([k,q])=>{
      const b=profile.thermal[k];return [k,b?.value ?? (k==='massKg'?ROVER_CONFIG.massKg:'Not applicable: environmental variable with its own source'),present(q.value,'no current source or parameter; see proposed basis'),q.unit,`${q.kind} / ${b?.kind || (k==='massKg'?'mission-config':'environmental reference')}`,present(q.source,'source not attached'),observed(q),b?`${b.source} · ${profile.revisionDate}`:k==='massKg'?ROVER_CONFIG.source:'Not applicable: no environmental observation proposed',b?b.rationale:q.value===null?'Current reading/configuration missing; not substituted with the profile':'Value from its source; does not imply local measurement'];
    }),[22,28,28,12,22,36,28,32,43],COLORS.cyan);
  const roverFields=['utc','elapsed','x','z','latitude','longitude','heading','speed','distance','battery','slopeDeg','pitchDeg','rollDeg','loadW','solarW','kind'];
  add('Rover_history','03 / SIMULATION LOG','Earth rover: simulated control/test with its own Earth coordinates. Its relative displacement is mirrored from the target contact; no geographic homology or connected hardware.',
    ['UTC','SIM (s)','x (m)','z (m)','Lat (°)','Lon (°)','Heading (°)','Speed (m/s)','Dist. (m)','Battery (%)','Slope (°)','Pitch (°)','Roll (°)','Load (W)','Solar (W)','Type'],
    s.rover.length?s.rover.map(r=>roverFields.map(k=>present(r[k],`${k}: variable not recorded by the simulator`))):[[s.startedAt,...roverFields.slice(1,-1).map(()=> 'Not recorded: session start without sample'),'Session start; no invented movement']],
    [30,...Array(14).fill(17),32]);
  const weatherFields=['temperatureC','surfacePressurePa','windSpeedMs','relativeHumidityPct','solarRadiationWm2'];
  add('Weather_history','04 / WEATHER LOG','Earth weather: provider model or identified file; does not represent target weather or a local sensor. Precipitation omitted: not requested from the provider.',
    ['UTC observation','UTC capture','UTC query','Provider','State','Cache','Age (s)','Air (°C)','Pressure (Pa)','Wind (m/s)','Humidity (%)','Solar (W/m²)','Source'],
    s.weather.length?s.weather.map(t=>[present(t.observedAt,'observation date not reported'),present(t.capturedAt,'capture date not reported'),present(t.fetchedAt,'file without query date'),present(t.provider,'unidentified provider'),present(t.state,'unclassified state'),!!t.cached,present(t.observationAgeSeconds,'age not computed; check date'),...weatherFields.map(k=>present(t.values?.[k],`${k}: not provided by this provider`)),present(t.source?.url,'path not attached to the record')]):[[`No observation at cutoff ${cutoffUTC}`,cutoffUTC,'Not requested / no response','No provider recorded','offline / no observation','Not applicable: no query','Not applicable: no observation',...weatherFields.map(()=> 'Not observed: see context in Thermal'),'No weather source received']],
    [25,25,25,18,20,13,20,20,20,20,20,20,38]);
  add('Breakdown_matrix','05 / ASSESSMENT','Automatic audit states, kept without recomputing with design hypotheses. Evidence as text with source paths.',
    ['Factor','State','Strength','Breakdown','Procedure / recommendation','Evidence / path'],a.matrix.flatMap(r=>{
      const lines=humanEvidence(r.evidence).split('\n'),chunks=[];
      for(let i=0;i<lines.length;i+=8)chunks.push(lines.slice(i,i+8).join('\n'));
      return chunks.map((part,i)=>[`${r.label}${chunks.length>1?` · evidence ${i+1}/${chunks.length}`:''}`,r.status,r.strength,r.breakdown,r.action,part]);
    }),[29,18,47,52,58,75]);
  const pressureReason = key => key==='earthToTargetRatio'&&cal.inputs.targetPressurePa===0 ? 'Not applicable: ideal vacuum / division by zero' : key==='targetToEarthRatio'&&cal.inputs.earthPressurePa===0?'Not applicable: zero Earth pressure / division by zero':missing('missing absolute Earth or target pressure from its source');
  add('Calibration','06 / GRAVITY BENCH','Two static load modes: same mass with support or equivalent mass without support. Forces are not safety thresholds.',
    ['Mode','Variable','Current value / model','Unit','Model / formula','Origin / limit'],[
      ['offload','Original mass',cal.inputs.massKg,'kg','m',ROVER_CONFIG.source],['offload','Earth weight',g.earthWeightN,'N','m·g_Earth','Gravity reference + prototype'],
      ['ambos','Target weight',g.targetWeightN,'N','m·g_tgt','Gravity reference + prototype'],['offload','Vertical support',g.offloadForceN,'N','m·(g_Earth−g_tgt)','Level ground, quasi-static'],
      ['equivalent','Test mass',g.equivalentEarthMassKg,'kg','m·g_tgt/g_Earth','Different inertia; no dynamic equivalence'],['equivalent','Vertical support',0,'N','No support','Explicit zero of the equivalent-mass mode'],
      ['ambos','Pressure difference',present(cal.pressure.differencePa, 'missing absolute Earth or target pressure'),'Pa','p_Earth−p_tgt','Not equivalent to atmospheric composition'],
      ...[['targetToEarthRatio','Pressure ratio','p_tgt/p_Earth'],['earthToTargetRatio','Inverse ratio','p_Earth/p_tgt']].map(([k,label,f])=>['ambos',label,cal.pressure[k]??pressureReason(k),'1',f,'Positive denominator; lunar 0 Pa is an ideal vacuum']),
      ...cal.formulas.map(f=>['model','Formula',f,'SI','Local evaluation','Informative expression, no cell formula']),
      ...cal.assumptions.map(f=>['model','Assumption',f,'Not applicable: text','Declared hypothesis','Test model limitation']),
      ...profile.assumptions.map(f=>['proposed basis','Profile assumption',f,'Not applicable: text',profile.source,'Separate from observation and the manual lab'])
    ],[23,34,53,23,46,60]);
  const thermalNames={areaM2:'Exchange area',surfaceK:'Equipment surface setpoint',surroundingsK:'Bench surroundings setpoint',hWm2K:'Bench convective coefficient',emissivity:'Assumed emissivity'};
  add('Thermal','07 / THERMAL MODEL','BASE: design bench, gas at explicit T_surroundings. CURRENT: calculation only with complete mission inputs. Ambient temperature ≠ equipment temperature.',
    ['Variable','Design basis value','Current available value','Unit','Base / current type','Source / model','State / limit'],[
      ...Object.entries(profile.thermal).map(([k,q])=>[thermalNames[k],q.value,present(cal.inputs[k],'equipment parameter not configured in mission'),q.unit,`${q.kind} / ${cal.origins[k].kind}`,q.source,q.rationale]),
      ['Bench gas (T_air)',design.calibration.inputs.airK,present(cal.inputs.airK,'no Earth air from the provider'),'K','derived-design / '+cal.origins.airK.kind,profile.source,design.airSource],
      ...['convectionW','radiationW'].map((k,i)=>[i?'Q radiation':'Q convection',design.calibration.thermal[k],present(cal.thermal[k],`current calculation incomplete: ${i?'area, emissivity, Ts and T_surroundings':'h, area, Ts or T_air'} unavailable`),'W','bench model / current model',i?'ε·σ·A·(Ts⁴−Tsurr⁴)':'h·A·(Ts−Tair)',design.scope]),
      ...[['Earth air',c.earth.airTemperature,'value'],['Earth surface',c.earth.surfaceTemperature,'meanK'],['Mean target surface',c.target.surfaceTemperature,'meanK'],['Minimum target surface',c.target.surfaceTemperature,'minK'],['Maximum target surface',c.target.surfaceTemperature,'maxK']].map(([label,q,key])=>[label,'Not applicable: environmental context, not an equipment setpoint',present(q[key],'temperature not provided by source'),'K',`Not applicable / ${q.kind}`,present(q.source,'reference not attached'),'Comparison context; does not feed equipment Ts or T_surroundings']),
      ...['earth','target'].map(side=>[`Ionizing dose ${side}`,'Not applicable: the profile proposes an instrument, not an ambient dose',present(c[side].ionizingDoseRate.value,'no local dosimetry'),'Sv/s','Not applicable / missing','No instrument connected','Not derived from solar irradiance or NASA imagery']),
      ...cal.assumptions.map(f=>['Thermal hypothesis','Model text','Model text','Not applicable: text','model',f,'Positive Q = loss; incomplete balance without conduction and transients'])
    ],[30,28,38,13,24,42,53],COLORS.cyan);
  // One instrument parameter per row: each value, scope and justification remains searchable.
  add('Tools','08 / PROPOSED EQUIPMENT','Per-mission profile: per-unit values, no physical connection. Do not add the external kit or test equipment to the 350 kg or double-count included components.',
    ['Tool / quantity','Function / mass scope','Parameter','Design basis value','Unit','Current available value','Base type','Base source','State / limit'],profile.tools.flatMap(tool=>tool.parameters.map(p=>[
      `${tool.name} · ×${tool.quantity}`,`${tool.purpose}\n${tool.role} · ${tool.massScope}`,p.label,p.value,p.unit,
      tool.id==='rover'&&p.key==='massKg'?ROVER_CONFIG.massKg:'Not measured: proposed instrument without connection',p.kind,p.source,`${tool.status} · ${p.rationale}`
    ])),[27,37,28,25,12,28,19,27,48],COLORS.acid);
  const assets=[...(manifest.assets||[]),...(manifest.textures||[])];
  add('NASA_assets','09 / VISUAL CONTEXT','Presentation assets with paths and credits preserved. Normalized mesh scale and textures do not provide scientific parameters.',
    ['ID / name','Class / role','Local path','Source / credit','Integrity / license','Scale / units','Transformation / limit'],assets.length?assets.map(v=>[
      `${v.id} · ${v.label}`,v.role || 'Texture: visual context',present(v.localPath,'asset without local path'),`${present(v.sourceUrl,'URL not attached')}\n${present(v.credit,'credit not attached')}`,`${present(v.sha256,'SHA256 not attached')}\n${present(v.licenseUrl,'license not attached')}\n${present(v.bytes,'size not attached')} bytes`,
      /texture/.test(v.role || '') || ['jpg','png','jpeg'].includes(v.format)
        ? (v.projection?.dimensions?.length===2 ? `${v.projection.dimensions[0]} × ${v.projection.dimensions[1]} pixels · visual context` : v.width&&v.height ? `${v.width} × ${v.height} pixels · visual context` : 'Visual context')
        : v.units && v.units!=='unknown' ? typeof v.units==='object' ? leaves(v.units).map(([k,x])=>`${k}: ${x}`).join('\n') : v.units : 'Visual scale; physical units not verified',
      `${v.transformations||v.notes?leaves(v.transformations||v.notes).map(([k,x])=>`${k}: ${x}`).join('\n'):'No documented transformation'}\nVisual only: provides no mass, temperature or certification`
    ]):[['No manifest attached','Visual context unavailable','Not attached at cutoff','Not attached at cutoff','Not applicable: no assets attached','Visual scale; physical units not verified','The export keeps the profile and science without visual assets']], [28,23,40,48,45,30,48]);
  add('Sources','10 / DOCUMENTARY RECORD','Revision and capture dates kept separate from observation. Files and references are not presented as current weather.',
    ['Name / field','Source / path','Date / class','Limit / use'],[
      ...Object.entries(SOURCES).map(([k,v])=>[k,v,'Reference: no observation date','Constants / rounded model scope']),
      ['Base profile',profile.source,`Revision ${profile.revisionDate} · v${profile.version}`,'Design basis: no observation date'],
      ['Weather',present(c.earth.telemetry?.source?.url,'no weather source received'),c.earth.telemetry?.observedAt || 'No observation available',`${sourceState} · provider or file; not a local sensor`],
      ...['earth','target'].flatMap(side=>(c[side].provenance||[]).map(p=>[`${side}: ${p.label}`,present(p.url,'path not attached'),c[side].grid?.fetchedAt || 'Reference: no capture date','DEM/documentary context; not an equipment reading']))
    ],[38,83,40,62]);
  add('Limits_events','11 / LOGBOOK','Events of this session and model limits. Accelerated SIM and UTC time have different scopes.',
    ['Type','UTC / scope','SIM (s)','Detail'],[
      ...LIMITS.map(t=>['Limit','All sessions','Not applicable: documentary limit',t]),
      ...s.events.map(e=>[e.type,e.utc,present(e.elapsedSIM,'event without SIM clock'),typeof e.detail==='object'?leaves(e.detail).map(([k,v])=>`${k}: ${v}`).join('\n'):present(e.detail,'event without attached detail')]),
      ...s.events.length?[]:[['Start / cutoff',s.startedAt,'Not recorded: no sample',`Session created; cutoff ${cutoffUTC}. No events or readings were invented.`]],
      ['Retention','Local memory','Not applicable: policy',s.policy?.retention || 'Session memory: reloading clears the logs']
    ],[28,34,36,110]);
  if (landing) addLandingSheets(landing,c,add);
  return sheets;
}
export const missionWorkbook = snapshot => workbookBytes(missionSheets(snapshot));

// The landing craft is a proposed profile; all unavailable readings retain a cause.
function addLandingSheets(l,c,add) {
  const targetFirst=l.missionMode==='target-first', sides=targetFirst?['target','earth']:['earth','target'];
  const noEarth='Not applicable: no Earth descent';
  const label={earth:targetFirst?'Earth analog / reference':'Virtual Earth (legacy)',target:'Primary target '+c.target.name};
  const absent='Unavailable: the descent state/source did not provide this field';
  const val=v=>{const result=present(v,absent);return typeof result==='string'?result.replace(/\bnull\b/g,'no data').replace(/\bundefined\b/g,'undefined'):result;};
  const text=v=>v===null || v===undefined?missing(absent):typeof v==='object'?leaves(v).map(([k,x])=>`${k}: ${val(x)}`).join('\n'):val(v);
  const profileFields=[
    ['id','Lander profile','identificador'],['kind','Class','texto'],['body','Body','texto'],
    ['landerDryMassKg','Dry lander without payload','kg'],['payloadKg','Payload','kg'],['dryMassKg','Total dry mass','kg'],['propellantKg','Initial propellant','kg'],
    ['ispSeconds','Proposed specific impulse','s'],['g0Ms2','Isp g0 reference','m/s²'],['gravityMs2','Model gravity','m/s²'],['thrustMaxN','Proposed maximum thrust','N'],['tiltMaxDeg','Maximum thrust tilt','°'],
    ['startAltitudeM','Initial AGL height','m'],['startVerticalSpeedMs','Initial vertical speed','m/s'],['startOffsetXM','Initial offset x','m'],['startOffsetZM','Initial offset z','m'],['maxDescentSpeedMs','Maximum descent speed','m/s'],['finalDescentSpeedMs','Proposed terminal speed','m/s'],['maxAccelerationMs2','Maximum acceleration','m/s²'],['brakingAccelerationMs2','Braking acceleration','m/s²'],['lateralAccelerationMs2','Lateral acceleration','m/s²'],['maxSimSeconds','Maximum SIM duration','s'],['assumptions','Model hypothesis','texto'],
    ['touchdownVerticalSpeedMs','Vertical contact tolerance','m/s'],['touchdownHorizontalSpeedMs','Horizontal contact tolerance','m/s'],['touchdownTiltDeg','Contact tilt tolerance','°'],['touchdownPositionErrorM','Position error tolerance','m'],['maxRegionalSlopeDeg','Regional slope tolerance','°'],['maxRegionalReliefM','Regional relief tolerance','m']
  ];
  const source=side=>text(l.profiles[side]?.sources || l.profiles[side]?.source || l.profiles[side]?.kind || 'Atlas design proposal; see docs/descenso-modelo.md');
  const paired=(section,key,title,unit)=>{
    const maps=sides.map(side=>new Map(targetFirst && side==='earth' && section==='runs' ? [] : leaves(l[section]?.[side]?.[key])));
    return [...new Set(maps.flatMap(m=>[...m.keys()]))].map(path=>[section,`${title}${path?' / '+path:''}`,...maps.map((m,i)=>targetFirst && sides[i]==='earth' && section==='runs' ? noEarth : val(m.get(path))),unit,section==='profiles'?'Design proposal / reference; not a measurement':'Simulated state at cutoff','Profile and sources attached; docs/descenso-modelo.md. Model contact does not certify terrain.']);
  };
  const rows=[
    ['Capture','Mission / scenario',l.missionId,l.scenarioId,'identificador',`Global phase: ${l.phase}`,'Active session at cutoff; not a replay or lab'],
    ['Clocks','UTC start / end',l.startedAtUTC,l.endedAtUTC || 'In progress: descent not finished yet','UTC','Capture date, not SIM duration','Not equivalent to the ×20 accelerated rover clock'],
    ['Clocks','Descent presentation scale',val(l.timeScale),'Rover: independent SIM ×20','visual/time factor','Does not modify the SI integration','UTC and SIM duration are not interchangeable'],
    ['Scope','Conditions',...(targetFirst?['Moon: no atmosphere; Mars: idealized final powered segment only','Simulated test/control analog, no Earth descent']:['Virtual Earth comparison','Moon: no atmosphere; Mars: idealized final powered segment only']),'texto','Exploratory model',LANDING_SCOPE],
    ...(targetFirst ? [
      ['Mission','Purpose','Choose target zone and fuel','Prepare and rehearse Earth rover control','texto','Primary target / reference analog','Only nominal target contact enables deployment; no second landing is chosen'],
      ['Exploration','Own origin',text(l.explorationOrigins?.target),text(l.explorationOrigins?.earth),'m / degrees','target-contact / analogue-test-origin','Earth surface origin; not lander contact or target coordinates'],
      ['Exploration','Relative mirror',l.mirrorAvailable?'Available':'Limited: without both origins/contact','roverEarth − originEarth','m','targetContact + Earth displacement','No geographic homology; missing Earth does not block target descent'],
      ['Sources','Environment and instruments','Target references; no connected instruments','Earth analog weather and proposed tools','texto','Separate sources','Earth weather is not attributed to the target; no hardware telemetry']
    ] : []),
    ['Equipment','Rover and lander',350,'Lander profile separate from the rover','kg rover','Rover configuration; lander mass in profile rows','Do not add or substitute lander mass with the 350 kg rover'],
    ...profileFields.flatMap(([key,title,unit])=>paired('profiles',key,title,unit)),
    ...[['phase','Physical phase','texto'],['outcome','Result / cause','texto'],['simSeconds','SIM descent time','s'],['altitudeM','Current AGL height','m'],['yM','DEM datum height','m'],['groundElevationM','DEM datum ground','m'],['verticalSpeedMs','Vertical speed','m/s'],['horizontalSpeedMs','Horizontal speed','m/s'],['thrustN','Current thrust','N'],['propellantKg','Remaining propellant','kg'],['massKg','Current lander mass','kg'],['x','Contact / pose x','m'],['z','Contact / pose z','m'],['georeference','Own georeference','degrees'],['target','Own target zone','texto'],['contact','Model contact checks','texto'],['limits','Model physical limits','texto'],['faultCodes','Recorded failures','texto']].flatMap(([key,title,unit])=>paired('runs',key,title,unit)),
    ...sides.flatMap(side=>leaves(l.profiles[side]?.sources || l.profiles[side]?.source || {reference:'docs/descenso-modelo.md; no external source attached'}).map(([key,value])=>['Profile source',label[side],key,value,'texto','Reference / design proposal','Documentary reference; no local measurement'])),
    ...sides.flatMap(side=>(l.profiles[side]?.limitations || []).map(x=>['Profile limit',label[side],x,'Not applicable: documentary limit','texto','Design proposal',source(side)])),
    ...[LANDING_SCOPE,...l.limitations].map(x=>['Common limit','Simulation',x,'Not applicable: documentary limit','texto','Does not certify safety','Local contract LandingRunPayload 1.0.0']),
    ...l.events.map(e=>['Event '+e.type,e.utc,e.simSeconds,text(e.detail),'s SIM descent','UTC and SIM kept separate','Real simulator log; no physical event'])
  ];
  add('Descent','12 / LANDER AND RESULT',targetFirst?'Primary target: single descent. Earth keeps reference profile/plan and test origin; it did not fly. Regional model tolerances without certification.':'Proposed profiles and independent simulated states for Earth and target (paired-legacy).',
    ['Scope / path','Variable',...(targetFirst?['Primary target / data','Earth analog-reference / data']:['Virtual Earth / data','Target / data']),'Unit','Type / state','Source / limit'],rows,[23,33,43,43,16,36,68]);
  const fields=['altitudeM','verticalSpeedMs','horizontalSpeedMs','thrustN','propellantKg','x','z','pitchDeg','rollDeg'];
  const trajectory=l.history.flatMap(h=>sides.filter(side=>h[side]!==null && h[side]!==undefined).map(side=>{
    const r=h[side];return [h.utc,h.simSeconds,val(r?.simSeconds),label[side],val(r?.phase),...fields.map(k=>val(r?.[k])),text(r?.outcome)];
  }));
  if (!trajectory.length) trajectory.push([l.startedAtUTC,'No sample: capture start','No descent sample',targetFirst?'Primary target: no recorded flight':'No recorded flights','No sample',...fields.map(()=> 'Not recorded: no flight sample yet'),'No result: contact is not inferred']);
  add('Trajectory','13 / DESCENT HISTORY','Bounded samples (max 1200; producer 2–5 Hz). Vertical V positive up; contact uses magnitude relative to ground. UTC and SIM per lander kept separate from the ×20 rover; no interpolation.',
    ['UTC capture','SIM capture (s)','SIM lander (s)','Body','Physical phase','AGL (m)','V vertical (m/s)','V horizontal (m/s)','Thrust (N)','Propellant (kg)','x (m)','z (m)','Pitch (°)','Roll (°)','Result / cause'],trajectory,[27,17,17,23,19,...Array(9).fill(17),43],COLORS.cyan);
  const zoneRows=[];
  for (const side of sides) {
    const plan=l.plans[side],grid=c[side].grid || {};
    const metadata=plan?Object.fromEntries(Object.entries(plan).filter(([k])=>k!=='zones')):{state:'No plan: source/DEM unavailable'};
    for (const [path,value] of leaves(metadata)) zoneRows.push([label[side],'Metadata '+path,'Not applicable: metadata',val(value),'Not applicable: metadata','Not applicable: metadata','Not applicable: metadata','Not applicable: metadata','Not applicable: metadata','Not applicable: metadata',text(c[side].center),'Context of its own DEM; no automatic homology']);
    for (const [path,value] of leaves(grid)) zoneRows.push([label[side],'dataset.'+path,'Not applicable: metadata',val(value),'Not applicable: metadata','Not applicable: metadata','Not applicable: metadata','Not applicable: metadata','Not applicable: metadata','Not applicable: metadata',text(c[side].center),'Native resolution, effective resolution and coverage differ; regional scale']);
    for (const z of plan?.zones || []) zoneRows.push([label[side],z.id,targetFirst && side==='earth'?'Reference: no descent':z.id===plan.selectedId?'Model selection':'Regional alternative',val(z.score),val(z.status),val(z.x),val(z.z),val(z.slopeDeg),val(z.reliefM),val(z.scienceDistanceM),text(z.georeference),`${text(z.reason)}\nCoverage: ${val(z.coverage)} (0..1). Native: ${val(z.nativeResolutionMeters)} m; effective step: ${val(z.spacingMeters)} m; neighborhood: ${val(z.scaleMeters)} m. Maximum slope: ${val(z.maxSlopeDeg)}°. Eligible: ${val(z.eligible)}.`]);
    if (!plan?.zones?.length) zoneRows.push([label[side],'No candidates','No selection','Not evaluable: DEM/plan missing','unevaluable',...Array(5).fill('Not evaluable: no candidate'), 'No candidate georeference','Contact or a safe zone is not forced']);
    if (targetFirst) for (const [path,value] of leaves(l.explorationOrigins?.[side] || {state:side==='earth'?'No Earth origin: limited mirror; independent target descent':'No target contact: deployment not enabled'})) zoneRows.push([label[side],'origin.'+path,side==='earth'?'Surface test origin':'Own target contact',value,...Array(6).fill('Not applicable: origin metadata'),text(c[side].center),'Body’s own georeference; relative-motion mirror, no homology']);
    for (const [path,value] of leaves(l.runs[side]?.georeference || {state:targetFirst && side==='earth'?noEarth:'No georeference: pose/DEM unavailable'})) zoneRows.push([label[side],'pose.'+path,'Pose at cutoff',value,...Array(6).fill('Not applicable: pose georeference'),text(c[side].center),'Pose of each body exported separately']);
  }
  add('Test_zone','14 / REGIONAL PLAN','Regional candidates, ranking and reason. The science center differs from the contact point. DEM resampled to 37.5 m does not resolve legs, rocks, walls or the Marius pit.',
    ['Body','ID / field','Selection / scope','Score / value','State','x (m)','z (m)','Slope (°)','Relief (m)','Science distance (m)','Georeference / center','Reason / limitation'],zoneRows,[23,37,27,30,24,19,19,19,19,22,42,62],COLORS.acid);
}
