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
const missing = reason => `Pendiente: ${reason}`;
const present = (value, reason = 'no registrado en el corte; no se inventa una lectura') => {
  if (value === null || value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return missing(reason);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') throw new Error('Representar objetos en filas desglosadas, no JSON');
  return value;
};
const observed = q => q?.observedAt || (['reference','prototype-design','derived-design','mission-config','diviner','idealization'].includes(q?.kind) ? 'Base de diseño: sin fecha de observación' : 'Sin fecha de observación: revisar fuente');
function leaves(value, path = '') {
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k,v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, present(value, 'campo no provisto por la fuente original')]];
}
function humanEvidence(evidence) {
  return (evidence || []).flatMap(e => leaves(e.data, e.path)).map(([p,v]) => `${p}: ${v}`).join('\n') || 'Sin evidencia adjunta: consultar el procedimiento';
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
  const s = (title, c, color) => `<c:ser><c:idx val="${c-1}"/><c:order val="${c-1}"/><c:tx><c:v>${title}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>'Resumen'!$A$25:$A$26</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>'Resumen'!$${col(c)}$25:$${col(c)}$26</c:f></c:numRef></c:val></c:ser>`;
  return `<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:lang val="es-ES"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es-ES" sz="1400"/><a:t>Carga estática y soporte vertical (N)</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="stacked"/>${s('Carga sobre suelo',1,COLORS.blue)}${s('Soporte vertical',2,COLORS.cyan)}<c:gapWidth val="100"/><c:axId val="1"/><c:axId val="2"/></c:barChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="1"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
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
        const unit = s.name==='Herramientas'?r[4]:['Termica','Calibracion','Datos_y_origen'].includes(s.name)?r[3]:null;
        const precise = unit ? ['1','m','m²','rad','°'].includes(unit) : /Lat|Lon/.test(s.rows[header-1]?.[j] || '');
        let style=special ?? (rn===1?1:rn===2?2:rn===3?3:!cover&&rn===header?4:numeric?(Math.abs(value)>0&&Math.abs(value)<0.0001?(odd?16:15):precise?(odd?14:13):(odd?8:7)):(odd?6:5));
        if(numeric && rn>header && (s.name==='Descenso' && /Georreferencia propia|Referencia Isp g0/.test(r[1]) || s.name==='Zona_ensayo' && /center|pose.latitude|pose.longitude/.test(r[1]))) style=odd?19:18;
        if(!special && rn>header && /^(Válido|valid$|proposed-design$|Completo$)/.test(String(value)))style=10;
        if(!special && rn>header && /^(Pendiente:|Parcial|partial$|unknown$)/.test(String(value)))style=11;
        if(!special && rn>header && /^(Ruptura|breakdown$)/.test(String(value)))style=17;
        return textCell(ref,value,style);
      }).join('')}</row>`;
    }).join('');
    const freeze=cover?'':`<pane ySplit="${header}" topLeftCell="A${header+1}" activePane="bottomLeft" state="frozen"/>`;
    const hyperlinks=(s.links || (s.headerRow ? [{ref:'A3',target:'Resumen'}] : [])).map(l=>`<hyperlink ref="${l.ref}" location="&apos;${xml(l.target)}&apos;!A1" display="${xml(l.target)}"/>`).join('');
    files.push([`xl/worksheets/sheet${i+1}.xml`,`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetPr><tabColor rgb="FF${s.tabColor||COLORS.blue}"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${s.rows.length}"/><sheetViews><sheetView showGridLines="0" zoomScale="80" workbookViewId="0">${freeze}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols>${widths.map((w,j)=>`<col min="${j+1}" max="${j+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${!cover?`<autoFilter ref="A${header}:${last}${s.rows.length}"/>`:''}${merges.length?`<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:''}${hyperlinks?`<hyperlinks>${hyperlinks}</hyperlinks>`:''}<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.15" footer="0.2"/><pageSetup paperSize="${cover?9:8}" orientation="${cover?'portrait':'landscape'}" fitToWidth="1" fitToHeight="${cover?1:0}"/><headerFooter><oddFooter>&amp;LAtlas · M2 / ${xml(s.name)}&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter>${s.chart?'<drawing r:id="drawing"/>':''}</worksheet>`]);
    if(s.chart)files.push([`xl/worksheets/_rels/sheet${i+1}.xml.rels`,`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="drawing" Type="${REL}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`]);
  });
  if(hasChart)files.push(['xl/charts/chart1.xml',chartXML()],['xl/drawings/drawing1.xml',`<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>27</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>40</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Comparación de carga estática"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${REL}" r:id="chart"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`],['xl/drawings/_rels/drawing1.xml.rels',`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="chart" Type="${REL}/chart" Target="../charts/chart1.xml"/></Relationships>`]);
  return zipStore(files);
}
export function missionSheets(snapshot) {
  const { candidate:c, audit:a, session:s, cutoffUTC, manifest={} }=snapshot;
  let landing = snapshot.landing ?? s.landing ?? null;
  if (snapshot.landing && s.landing && JSON.stringify(snapshot.landing)!==JSON.stringify(s.landing)) throw new Error('Descenso incompatible: dos capturas distintas en el corte');
  if (landing) {
    const result=captureLanding(landing,{missionId:s.id,scenarioId:c.scenario.id,body:c.scenario.body,earthId:c.scenario.earthId,targetId:c.scenario.targetId,startedAt:s.startedAt});
    if (!result.valid) throw new Error(`Descenso incompatible: ${result.errors.join('; ')}`);
    landing=result.value;
  }
  const profile=snapshot.baseProfile || getMissionBaseProfile(c.scenario);
  const valid=validateMissionBaseProfile(profile);
  if(!valid.valid || profile.scenarioId!==c.scenario.id)throw new Error(`Perfil base incompatible: ${valid.errors.join('; ')}`);
  const design=missionDesignEngineering(c,profile), cal=a.calibration, g=cal.gravity, sheets=[];
  const title=c.scenario.title, sourceState=s.weatherState || (c.earth.telemetry?.provider==='snapshot'?'archive':'Sin observación disponible');
  const add=(name,section,description,header,rows,widths,tabColor=COLORS.blue)=>{
    const w=header.length, last=col(w-1);
    sheets.push({name,headerRow:6,widths,tabColor,rows:[[`S.E.L.E.N.E / ATLAS   ·   ${section}`],[`${name.replaceAll('_',' ')}  /  ${title}`],['← Resumen',`M2 / ${c.scenario.id}`,'UTC y SIM separados · Atlas / Mission Control'],[description],[`Corte UTC ${cutoffUTC} · Perfil ${profile.version} revisado ${profile.revisionDate} · Base de diseño ≠ medición`],header,...rows.map(row=>header.map((_,j)=>present(row[j])))],merges:[`A1:${last}1`,`A2:${last}2`,`C3:${last}3`,`A4:${last}4`,`A5:${last}5`],heights:{4:44,5:34}});
  };
  const coverRows=[
    ['S.E.L.E.N.E / ATLAS'], ['MÓDULO 02   /   MISSION CONTROL'],
    ['Misión →','Herramientas →','Térmica →','Calibración →','Fuentes →','Historial →'],
    ['DOSSIER DE MISIÓN'],[`${title}  ·  ${c.earth.name} ↔ ${c.target.name}\n${c.scenario.focus || profile.purpose}`],
    ['01 / ESTADO Y PROCEDENCIA'],[`${sourceState}  ·  ${c.earth.telemetry?.provider || 'sin proveedor observado'}  ·  Rover: simulación`],
    [`Observación clima: ${c.earth.telemetry?.observedAt || 'no registrada; consultar Datos y origen'}`],
    ['02 / INDICADORES DE ENSAYO ESTÁTICO'],
    ['MASA DEL PROTOTIPO','ESTRUCTURAL','PESO OBJETIVO','REFERENCIA','SOPORTE VERTICAL','MODELO'],
    [ROVER_CONFIG.massKg,'kg',g.targetWeightN,'N',g.offloadForceN,'N'],
    ['HERRAMIENTAS BASE','DISEÑO PROPUESTO','MUESTRAS ROVER','SIMULACIÓN','OBSERVACIONES CLIMA','PROVEEDOR'],
    [profile.tools.length,'sin conexión física',s.rover.length,'registro de sesión',s.weather.length,sourceState],
    ['03 / CORTE Y ALCANCE'],[`Corte UTC: ${cutoffUTC} · Inicio UTC: ${s.startedAt}`],[`Estado de sesión: ${s.endedAt || 'En curso'} · ID: ${s.id}`],
    ['Auditoría exploratoria: no certifica GO/NO-GO. Las bases no se guardan como lecturas en el historial.'],
    ['04 / PERFIL BASE DE DISEÑO'],[`${profile.title} · v${profile.version} · revisión ${profile.revisionDate}`],
    [`${profile.purpose}\n${profile.assumptions[0]}`],
    ['LEYENDA / LEER ANTES DE COMPARAR'],['Medición: solo sensor identificado · Modelo: cálculo o meteorología de proveedor\nReferencia: fuente documental / archivo · Base propuesta: setpoint o equipo de diseño, sin validación física'],
    ['05 / COMPARACIÓN NATIVA · CARGAS EN NEWTON'],
    ['Modo de ensayo','Carga suelo (N)','Soporte (N)','Masa ensayo (kg)','Total vertical (N)','Alcance'],
    ['offload',g.targetWeightN,g.offloadForceN,cal.inputs.massKg,g.earthWeightN,'Misma masa; soporte cuasiestático'],
    ['equivalent',g.targetWeightN,0,g.equivalentEarthMassKg,g.targetWeightN,'Masa reducida; inercia distinta'],
    ['La carga sobre el suelo coincide en ambos modos; el soporte y la masa del ensayo cambian.'],
    ...Array.from({length:13},()=>[]),
    ['ARCHIVO LOCAL · Sin macros ni fórmulas de celdas · Fuentes y límites trazables en cada sección']
  ];
  if (landing) coverRows[16] = [`DESCENSO / ${landing.phase} · Objetivo principal: ${landing.runs.target?.phase || 'no disponible'} · Tierra: ${landing.missionMode==='target-first' ? 'No aplica: sin descenso terrestre' : landing.runs.earth?.phase || 'no disponible'}. Contacto simulado; sin certificación. Ver Descenso / Trayectoria / Zona_ensayo.`];
  const coverMerges=[1,2,4,5,6,7,8,9,14,15,16,17,18,19,20,21,22,23,27,41].map(r=>`A${r}:F${r}`);
  sheets.push({name:'Resumen',cover:true,chart:true,rows:coverRows,widths:[25,22,23,22,23,26],merges:coverMerges,links:['Mision','Herramientas','Termica','Calibracion','Fuentes','Historial_rover'].map((target,i)=>({ref:`${col(i)}3`,target})),rowStyles:{1:1,2:2,4:3,6:4,9:4,10:9,11:12,12:9,13:3,14:4,18:4,21:4,23:4,24:4,41:9},heights:{1:48,2:32,3:26,4:25,5:58,6:25,7:30,8:28,9:25,10:30,11:40,12:34,13:34,14:25,15:32,16:32,17:landing?65:35,18:25,19:32,20:62,21:25,22:60,23:25,24:42,25:40,26:40,27:38,...Object.fromEntries(Array.from({length:13},(_,i)=>[i+28,19])),41:28},tabColor:COLORS.acid});
  add('Mision','01 / CONTEXTO','Escenario y presentación con rutas completas. Las mallas NASA son visuales: sus unidades físicas no se infieren de la escala en pantalla.',
    ['Campo / ruta','Valor actual disponible','Tipo / origen','Límite / interpretación'],[
      ...leaves(c.scenario).map(([k,v])=>[k,v,'scenario','Configuración de escenario; sin certificación de misión']),
      ['Perfil base',profile.id,profile.source,`${profile.kind} · revisión ${profile.revisionDate}; no observación`],
      ...leaves(snapshot.visualPresentation || {state:'No se adjuntó presentación visual'}).map(([k,v])=>[`visual.${k}`,v,'presentación','Escala visual; unidades físicas no verificadas']),
      ...leaves(s.latest || {state:'Sesión iniciada; aún sin muestras de simulación'}).map(([k,v])=>[`rover.current.${k}`,v,'sim','Última sincronización previa al corte; no lectura física']),
      ...['earth','target'].flatMap(side=>[['Sitio '+side,c[side].name,c[side].id,'Ubicación del escenario'],...leaves(c[side].center,'coordenadas').map(([k,v])=>[`${side}.${k}`,v,'grados','Latitud/longitud del centro regional']),...leaves(c[side].grid || {state:'Contexto visual sin DEM adjunto'}).map(([k,v])=>[`${side}.grid.${k}`,v,'archivo DEM','Escala regional; no valida geometría de malla normalizada'])])
    ],[35,58,34,56]);
  add('Datos_y_origen','02 / TRAZABILIDAD','La columna actual conserva la fuente real. La base de diseño es un setpoint propuesto y nunca reemplaza una observación faltante.',
    ['Variable','Valor base de diseño','Valor actual disponible','Unidad','Tipo actual / base','Fuente actual','Observación UTC','Fuente base / revisión','Estado / límite'],Object.entries(cal.origins).map(([k,q])=>{
      const b=profile.thermal[k];return [k,b?.value ?? (k==='massKg'?ROVER_CONFIG.massKg:'No aplica: variable ambiental con fuente propia'),present(q.value,'sin fuente o parámetro actual; consultar base propuesta'),q.unit,`${q.kind} / ${b?.kind || (k==='massKg'?'mission-config':'referencia ambiental')}`,present(q.source,'fuente no adjunta'),observed(q),b?`${b.source} · ${profile.revisionDate}`:k==='massKg'?ROVER_CONFIG.source:'No aplica: no se propone observación ambiental',b?b.rationale:q.value===null?'Falta lectura/configuración actual; no se sustituye con el perfil':'Valor de su fuente; no implica medición local'];
    }),[22,28,28,12,22,36,28,32,43],COLORS.cyan);
  const roverFields=['utc','elapsed','x','z','latitude','longitude','heading','speed','distance','battery','slopeDeg','pitchDeg','rollDeg','loadW','solarW','kind'];
  add('Historial_rover','03 / REGISTRO DE SIMULACIÓN','Rover Tierra: control/ensayo simulado con coordenadas terrestres propias. Su desplazamiento relativo se refleja desde contacto objetivo; sin homología geográfica ni hardware conectado.',
    ['UTC','SIM (s)','x (m)','z (m)','Lat (°)','Lon (°)','Rumbo (°)','Vel. (m/s)','Dist. (m)','Batería (%)','Pend. (°)','Pitch (°)','Roll (°)','Carga (W)','Solar (W)','Tipo'],
    s.rover.length?s.rover.map(r=>roverFields.map(k=>present(r[k],`${k}: variable no registrada por el simulador`))):[[s.startedAt,...roverFields.slice(1,-1).map(()=> 'No registrado: inicio de sesión sin muestra'),'Inicio de sesión; sin movimiento inventado']],
    [30,...Array(14).fill(17),32]);
  const weatherFields=['temperatureC','surfacePressurePa','windSpeedMs','relativeHumidityPct','solarRadiationWm2'];
  add('Historial_clima','04 / REGISTRO METEOROLÓGICO','Clima de Tierra: modelo del proveedor o archivo identificado; no representa clima del destino ni sensor local. Precipitación omitida: no solicitada al proveedor.',
    ['Observación UTC','Captura UTC','Consulta UTC','Proveedor','Estado','Cache','Edad (s)','Aire (°C)','Presión (Pa)','Viento (m/s)','Humedad (%)','Solar (W/m²)','Fuente'],
    s.weather.length?s.weather.map(t=>[present(t.observedAt,'fecha observación no informada'),present(t.capturedAt,'fecha captura no informada'),present(t.fetchedAt,'archivo sin fecha de consulta'),present(t.provider,'proveedor no identificado'),present(t.state,'estado no clasificado'),!!t.cached,present(t.observationAgeSeconds,'edad no calculada; revisar fecha'),...weatherFields.map(k=>present(t.values?.[k],`${k}: no provisto por este proveedor`)),present(t.source?.url,'ruta no adjunta al registro')]):[[`Sin observación al corte ${cutoffUTC}`,cutoffUTC,'No solicitado / sin respuesta','Sin proveedor registrado','offline / sin observación','No aplica: sin consulta','No aplica: sin observación',...weatherFields.map(()=> 'No observado: consultar contexto en Térmica'),'Sin fuente meteorológica recibida']],
    [25,25,25,18,20,13,20,20,20,20,20,20,38]);
  add('Matriz_ruptura','05 / EVALUACIÓN','Estados de la auditoría automática, conservados sin recalcular con hipótesis de diseño. Evidencia en texto con rutas de origen.',
    ['Factor','Estado','Fortaleza','Ruptura','Procedimiento / recomendación','Evidencia / ruta'],a.matrix.flatMap(r=>{
      const lines=humanEvidence(r.evidence).split('\n'),chunks=[];
      for(let i=0;i<lines.length;i+=8)chunks.push(lines.slice(i,i+8).join('\n'));
      return chunks.map((part,i)=>[`${r.label}${chunks.length>1?` · evidencia ${i+1}/${chunks.length}`:''}`,r.status,r.strength,r.breakdown,r.action,part]);
    }),[29,18,47,52,58,75]);
  const pressureReason = key => key==='earthToTargetRatio'&&cal.inputs.targetPressurePa===0 ? 'No aplica: vacío ideal / división por cero' : key==='targetToEarthRatio'&&cal.inputs.earthPressurePa===0?'No aplica: presión terrestre cero / división por cero':missing('falta presión absoluta terrestre u objetivo de su fuente');
  add('Calibracion','06 / BANCO DE GRAVEDAD','Dos modos de carga estática: misma masa con soporte o masa equivalente sin soporte. Las fuerzas no son umbrales de seguridad.',
    ['Modo','Variable','Valor actual / modelo','Unidad','Modelo / fórmula','Origen / límite'],[
      ['offload','Masa original',cal.inputs.massKg,'kg','m',ROVER_CONFIG.source],['offload','Peso terrestre',g.earthWeightN,'N','m·g_Tierra','Referencia de gravedad + prototipo'],
      ['ambos','Peso objetivo',g.targetWeightN,'N','m·g_obj','Referencia de gravedad + prototipo'],['offload','Soporte vertical',g.offloadForceN,'N','m·(g_Tierra−g_obj)','Suelo horizontal, cuasiestático'],
      ['equivalent','Masa ensayo',g.equivalentEarthMassKg,'kg','m·g_obj/g_Tierra','Inercia distinta; no equivalencia dinámica'],['equivalent','Soporte vertical',0,'N','Sin soporte','Cero explícito del modo masa equivalente'],
      ['ambos','Diferencia presión',present(cal.pressure.differencePa, 'falta presión absoluta terrestre u objetivo'),'Pa','p_Tierra−p_obj','No equivale composición atmosférica'],
      ...[['targetToEarthRatio','Razón presión','p_obj/p_Tierra'],['earthToTargetRatio','Razón inversa','p_Tierra/p_obj']].map(([k,label,f])=>['ambos',label,cal.pressure[k]??pressureReason(k),'1',f,'Denominador positivo; 0 Pa lunar es vacío ideal']),
      ...cal.formulas.map(f=>['modelo','Fórmula',f,'SI','Evaluación local','Expresión informativa, sin fórmula de celda']),
      ...cal.assumptions.map(f=>['modelo','Supuesto',f,'No aplica: texto','Hipótesis declarada','Limitación del modelo de ensayo']),
      ...profile.assumptions.map(f=>['base propuesta','Supuesto de perfil',f,'No aplica: texto',profile.source,'Separado de observación y del laboratorio manual'])
    ],[23,34,53,23,46,60]);
  const thermalNames={areaM2:'Área de intercambio',surfaceK:'Setpoint superficie del equipo',surroundingsK:'Setpoint entorno del banco',hWm2K:'Coeficiente convectivo del banco',emissivity:'Emisividad asumida'};
  add('Termica','07 / MODELO TÉRMICO','BASE: banco de diseño, gas a T_entorno explícito. ACTUAL: cálculo solo con entradas completas de la misión. Temperatura ambiental ≠ temperatura del equipo.',
    ['Variable','Valor base de diseño','Valor actual disponible','Unidad','Tipo base / actual','Fuente / modelo','Estado / límite'],[
      ...Object.entries(profile.thermal).map(([k,q])=>[thermalNames[k],q.value,present(cal.inputs[k],'parámetro del equipo sin configurar en misión'),q.unit,`${q.kind} / ${cal.origins[k].kind}`,q.source,q.rationale]),
      ['Gas del banco (T_aire)',design.calibration.inputs.airK,present(cal.inputs.airK,'no hay aire terrestre del proveedor'),'K','derived-design / '+cal.origins.airK.kind,profile.source,design.airSource],
      ...['convectionW','radiationW'].map((k,i)=>[i?'Q radiación':'Q convección',design.calibration.thermal[k],present(cal.thermal[k],`cálculo actual incompleto: ${i?'área, emisividad, Ts y T_entorno':'h, área, Ts o T_aire'} no disponibles`),'W','modelo de banco / modelo actual',i?'ε·σ·A·(Ts⁴−Tentorno⁴)':'h·A·(Ts−Taire)',design.scope]),
      ...[['Aire terrestre',c.earth.airTemperature,'value'],['Superficie terrestre',c.earth.surfaceTemperature,'meanK'],['Superficie objetivo media',c.target.surfaceTemperature,'meanK'],['Superficie objetivo mínima',c.target.surfaceTemperature,'minK'],['Superficie objetivo máxima',c.target.surfaceTemperature,'maxK']].map(([label,q,key])=>[label,'No aplica: contexto ambiental, no setpoint de equipo',present(q[key],'temperatura no aportada por fuente'),'K',`No aplica / ${q.kind}`,present(q.source,'referencia no adjunta'),'Contexto de comparación; no alimenta Ts del equipo ni T_entorno']),
      ...['earth','target'].map(side=>[`Dosis ionizante ${side}`,'No aplica: el perfil propone instrumento, no dosis ambiental',present(c[side].ionizingDoseRate.value,'sin dosimetría local'),'Sv/s','No aplica / missing','Sin instrumento conectado','No derivada de irradiancia solar ni de imagen NASA']),
      ...cal.assumptions.map(f=>['Hipótesis térmica','Texto del modelo','Texto del modelo','No aplica: texto','modelo',f,'Q positiva = pérdida; balance incompleto sin conducción y transitorios'])
    ],[30,28,38,13,24,42,53],COLORS.cyan);
  // One instrument parameter per row: each value, scope and justification remains searchable.
  add('Herramientas','08 / EQUIPO PROPUESTO','Perfil por misión: valores por unidad, sin conexión física. No sumar kit externo o equipo de ensayo a los 350 kg ni contar dos veces componentes incluidos.',
    ['Herramienta / cantidad','Función / ámbito masa','Parámetro','Valor base de diseño','Unidad','Valor actual disponible','Tipo base','Fuente base','Estado / límite'],profile.tools.flatMap(tool=>tool.parameters.map(p=>[
      `${tool.name} · ×${tool.quantity}`,`${tool.purpose}\n${tool.role} · ${tool.massScope}`,p.label,p.value,p.unit,
      tool.id==='rover'&&p.key==='massKg'?ROVER_CONFIG.massKg:'No medido: instrumento propuesto sin conexión',p.kind,p.source,`${tool.status} · ${p.rationale}`
    ])),[27,37,28,25,12,28,19,27,48],COLORS.acid);
  const assets=[...(manifest.assets||[]),...(manifest.textures||[])];
  add('Recursos_NASA','09 / CONTEXTO VISUAL','Activos de presentación con rutas y créditos conservados. Escala de malla normalizada y texturas no aportan parámetros científicos.',
    ['ID / nombre','Clase / papel','Ruta local','Fuente / crédito','Integridad / licencia','Escala / unidades','Transformación / límite'],assets.length?assets.map(v=>[
      `${v.id} · ${v.label}`,v.role || 'Textura: contexto visual',present(v.localPath,'recurso sin ruta local'),`${present(v.sourceUrl,'URL no adjunta')}\n${present(v.credit,'crédito no adjunto')}`,`${present(v.sha256,'SHA256 no adjunto')}\n${present(v.licenseUrl,'licencia no adjunta')}\n${present(v.bytes,'tamaño no adjunto')} bytes`,
      /texture/.test(v.role || '') || ['jpg','png','jpeg'].includes(v.format)
        ? (v.projection?.dimensions?.length===2 ? `${v.projection.dimensions[0]} × ${v.projection.dimensions[1]} píxeles · contexto visual` : v.width&&v.height ? `${v.width} × ${v.height} píxeles · contexto visual` : 'Contexto visual')
        : v.units && v.units!=='unknown' ? typeof v.units==='object' ? leaves(v.units).map(([k,x])=>`${k}: ${x}`).join('\n') : v.units : 'Escala visual; unidades físicas no verificadas',
      `${v.transformations||v.notes?leaves(v.transformations||v.notes).map(([k,x])=>`${k}: ${x}`).join('\n'):'Sin transformación documentada'}\nVisual únicamente: no aporta masa, temperatura ni certificación`
    ]):[['Sin manifiesto adjunto','Contexto visual no disponible','No adjunto al corte','No adjunta al corte','No aplica: no hay activos adjuntos','Escala visual; unidades físicas no verificadas','La exportación conserva el perfil y la ciencia sin recursos visuales']], [28,23,40,48,45,30,48]);
  add('Fuentes','10 / REGISTRO DOCUMENTAL','Fechas de revisión y captura separadas de observación. Archivos y referencias no se anuncian como clima actual.',
    ['Nombre / campo','Fuente / ruta','Fecha / clase','Límite / uso'],[
      ...Object.entries(SOURCES).map(([k,v])=>[k,v,'Referencia: sin fecha de observación','Constantes / alcance redondeado del modelo']),
      ['Perfil base',profile.source,`Revisión ${profile.revisionDate} · v${profile.version}`,'Base de diseño: sin fecha de observación'],
      ['Meteorología',present(c.earth.telemetry?.source?.url,'no se recibió fuente meteorológica'),c.earth.telemetry?.observedAt || 'Sin observación disponible',`${sourceState} · proveedor o archivo; no sensor local`],
      ...['earth','target'].flatMap(side=>(c[side].provenance||[]).map(p=>[`${side}: ${p.label}`,present(p.url,'ruta no adjunta'),c[side].grid?.fetchedAt || 'Referencia: sin fecha de captura','DEM/contexto documental; no lectura del equipo']))
    ],[38,83,40,62]);
  add('Limites_eventos','11 / BITÁCORA','Eventos de esta sesión y límites del modelo. SIM acelerado y hora UTC tienen ámbitos distintos.',
    ['Tipo','UTC / ámbito','SIM (s)','Detalle'],[
      ...LIMITS.map(t=>['Límite','Todas las sesiones','No aplica: límite documental',t]),
      ...s.events.map(e=>[e.type,e.utc,present(e.elapsedSIM,'evento sin reloj SIM'),typeof e.detail==='object'?leaves(e.detail).map(([k,v])=>`${k}: ${v}`).join('\n'):present(e.detail,'evento sin detalle adjunto')]),
      ...s.events.length?[]:[['Inicio / corte',s.startedAt,'No registrado: sin muestra',`Sesión creada; corte ${cutoffUTC}. No se inventaron eventos ni lecturas.`]],
      ['Retención','Memoria local','No aplica: política',s.policy?.retention || 'Memoria de sesión: recargar borra los registros']
    ],[28,34,36,110]);
  if (landing) addLandingSheets(landing,c,add);
  return sheets;
}
export const missionWorkbook = snapshot => workbookBytes(missionSheets(snapshot));

// The landing craft is a proposed profile; all unavailable readings retain a cause.
function addLandingSheets(l,c,add) {
  const targetFirst=l.missionMode==='target-first', sides=targetFirst?['target','earth']:['earth','target'];
  const noEarth='No aplica: sin descenso terrestre';
  const label={earth:targetFirst?'Tierra análogo / referencia':'Tierra virtual (legacy)',target:'Objetivo principal '+c.target.name};
  const absent='No disponible: el estado/fuente del descenso no aportó este campo';
  const val=v=>{const result=present(v,absent);return typeof result==='string'?result.replace(/\bnull\b/g,'sin dato').replace(/\bundefined\b/g,'no definido'):result;};
  const text=v=>v===null || v===undefined?missing(absent):typeof v==='object'?leaves(v).map(([k,x])=>`${k}: ${val(x)}`).join('\n'):val(v);
  const profileFields=[
    ['id','Perfil nave','identificador'],['kind','Clase','texto'],['body','Cuerpo','texto'],
    ['landerDryMassKg','Nave seca sin carga útil','kg'],['payloadKg','Carga útil','kg'],['dryMassKg','Masa seca total','kg'],['propellantKg','Propelente inicial','kg'],
    ['ispSeconds','Impulso específico propuesto','s'],['g0Ms2','Referencia Isp g0','m/s²'],['gravityMs2','Gravedad modelo','m/s²'],['thrustMaxN','Empuje máximo propuesto','N'],['tiltMaxDeg','Inclinación empuje máxima','°'],
    ['startAltitudeM','Altura inicial AGL','m'],['startVerticalSpeedMs','Velocidad vertical inicial','m/s'],['startOffsetXM','Offset inicial x','m'],['startOffsetZM','Offset inicial z','m'],['maxDescentSpeedMs','Velocidad descenso máxima','m/s'],['finalDescentSpeedMs','Velocidad terminal propuesta','m/s'],['maxAccelerationMs2','Aceleración máxima','m/s²'],['brakingAccelerationMs2','Aceleración frenado','m/s²'],['lateralAccelerationMs2','Aceleración lateral','m/s²'],['maxSimSeconds','Duración SIM máxima','s'],['assumptions','Hipótesis del modelo','texto'],
    ['touchdownVerticalSpeedMs','Tolerancia contacto vertical','m/s'],['touchdownHorizontalSpeedMs','Tolerancia contacto horizontal','m/s'],['touchdownTiltDeg','Tolerancia contacto inclinación','°'],['touchdownPositionErrorM','Tolerancia error posición','m'],['maxRegionalSlopeDeg','Tolerancia pendiente regional','°'],['maxRegionalReliefM','Tolerancia relieve regional','m']
  ];
  const source=side=>text(l.profiles[side]?.sources || l.profiles[side]?.source || l.profiles[side]?.kind || 'Propuesta de diseño Atlas; consultar docs/descenso-modelo.md');
  const paired=(section,key,title,unit)=>{
    const maps=sides.map(side=>new Map(targetFirst && side==='earth' && section==='runs' ? [] : leaves(l[section]?.[side]?.[key])));
    return [...new Set(maps.flatMap(m=>[...m.keys()]))].map(path=>[section,`${title}${path?' / '+path:''}`,...maps.map((m,i)=>targetFirst && sides[i]==='earth' && section==='runs' ? noEarth : val(m.get(path))),unit,section==='profiles'?'Propuesta de diseño / referencia; no medición':'Estado simulado al corte','Perfil y fuentes adjuntos; docs/descenso-modelo.md. Contacto del modelo no certifica terreno.']);
  };
  const rows=[
    ['Captura','Misión / escenario',l.missionId,l.scenarioId,'identificador',`Fase global: ${l.phase}`,'Sesión activa al corte; no replay ni laboratorio'],
    ['Relojes','Inicio / fin UTC',l.startedAtUTC,l.endedAtUTC || 'En curso: aún sin fin del descenso','UTC','Fecha de captura, no duración SIM','No equivale al reloj del rover acelerado ×20'],
    ['Relojes','Escala presentación descenso',val(l.timeScale),'Rover: SIM ×20 independiente','factor visual/temporal','No modifica la integración SI','UTC y duración SIM no son intercambiables'],
    ['Alcance','Condiciones',...(targetFirst?['Luna: sin atmósfera; Marte: solo tramo propulsado final idealizado','Análogo de ensayo/control simulado, sin descenso terrestre']:['Comparación virtual terrestre','Luna: sin atmósfera; Marte: solo tramo propulsado final idealizado']),'texto','Modelo exploratorio',LANDING_SCOPE],
    ...(targetFirst ? [
      ['Misión','Propósito','Elegir zona y combustible del objetivo','Preparar y ensayar control del rover terrestre','texto','Destino principal / análogo de referencia','Solo contacto nominal objetivo habilita despliegue; no se elige segundo aterrizaje'],
      ['Exploración','Origen propio',text(l.explorationOrigins?.target),text(l.explorationOrigins?.earth),'m / grados','target-contact / analogue-test-origin','Origen Tierra en superficie; no contacto de nave ni coordenadas del objetivo'],
      ['Exploración','Espejo relativo',l.mirrorAvailable?'Disponible':'Limitado: sin ambos orígenes/contacto','roverEarth − origenEarth','m','contactoTarget + desplazamiento Tierra','Sin homología geográfica; ausencia de Tierra no bloquea descenso objetivo'],
      ['Fuentes','Ambiente e instrumentos','Referencias del objetivo; sin instrumentos conectados','Meteorología del análogo terrestre y herramientas propuestas','texto','Fuentes separadas','Clima terrestre no se atribuye al destino; sin telemetría de hardware']
    ] : []),
    ['Equipo','Rover y nave',350,'Perfil nave separado del rover','kg rover','Configuración rover; masa nave en filas de perfil','No sumar ni sustituir masa de nave con 350 kg de rover'],
    ...profileFields.flatMap(([key,title,unit])=>paired('profiles',key,title,unit)),
    ...[['phase','Fase física','texto'],['outcome','Resultado / causa','texto'],['simSeconds','Tiempo descenso SIM','s'],['altitudeM','Altura AGL actual','m'],['yM','Altura datum DEM','m'],['groundElevationM','Suelo datum DEM','m'],['verticalSpeedMs','Velocidad vertical','m/s'],['horizontalSpeedMs','Velocidad horizontal','m/s'],['thrustN','Empuje actual','N'],['propellantKg','Propelente restante','kg'],['massKg','Masa actual nave','kg'],['x','Contacto / pose x','m'],['z','Contacto / pose z','m'],['georeference','Georreferencia propia','grados'],['target','Zona objetivo propia','texto'],['contact','Chequeos contacto modelo','texto'],['limits','Límites físicos modelo','texto'],['faultCodes','Fallas registradas','texto']].flatMap(([key,title,unit])=>paired('runs',key,title,unit)),
    ...sides.flatMap(side=>leaves(l.profiles[side]?.sources || l.profiles[side]?.source || {reference:'docs/descenso-modelo.md; sin fuente externa adjunta'}).map(([key,value])=>['Fuente perfil',label[side],key,value,'texto','Referencia / propuesta de diseño','Referencia documental; sin medición local'])),
    ...sides.flatMap(side=>(l.profiles[side]?.limitations || []).map(x=>['Límite perfil',label[side],x,'No aplica: límite documental','texto','Propuesta de diseño',source(side)])),
    ...[LANDING_SCOPE,...l.limitations].map(x=>['Límite común','Simulación',x,'No aplica: límite documental','texto','No certifica seguridad','Contrato local LandingRunPayload 1.0.0']),
    ...l.events.map(e=>['Evento '+e.type,e.utc,e.simSeconds,text(e.detail),'s SIM descenso','UTC y SIM separados','Registro real del simulador; sin evento físico'])
  ];
  add('Descenso','12 / NAVE Y RESULTADO',targetFirst?'Objetivo principal: único descenso. Tierra conserva perfil/plan de referencia y origen de ensayo; no voló. Tolerancias regionales del modelo sin certificación.':'Perfiles propuestos y estados simulados independientes de Tierra y objetivo (paired-legacy).',
    ['Ámbito / ruta','Variable',...(targetFirst?['Objetivo principal / dato','Tierra análogo-referencia / dato']:['Tierra virtual / dato','Objetivo / dato']),'Unidad','Tipo / estado','Fuente / límite'],rows,[23,33,43,43,16,36,68]);
  const fields=['altitudeM','verticalSpeedMs','horizontalSpeedMs','thrustN','propellantKg','x','z','pitchDeg','rollDeg'];
  const trajectory=l.history.flatMap(h=>sides.filter(side=>h[side]!==null && h[side]!==undefined).map(side=>{
    const r=h[side];return [h.utc,h.simSeconds,val(r?.simSeconds),label[side],val(r?.phase),...fields.map(k=>val(r?.[k])),text(r?.outcome)];
  }));
  if (!trajectory.length) trajectory.push([l.startedAtUTC,'Sin muestra: inicio de captura','Sin muestra de descenso',targetFirst?'Objetivo principal: sin vuelo registrado':'Sin vuelos registrados','Sin muestra',...fields.map(()=> 'No registrado: aún sin muestra de vuelo'),'Sin resultado: no se infiere contacto']);
  add('Trayectoria','13 / HISTORIAL DEL DESCENSO','Muestras acotadas (máximo 1200; productor 2–5 Hz). V vertical positiva arriba; contacto usa magnitud relativa al suelo. UTC y SIM por nave separados del rover ×20; sin interpolación.',
    ['UTC captura','SIM captura (s)','SIM nave (s)','Cuerpo','Fase física','AGL (m)','V vertical (m/s)','V horizontal (m/s)','Empuje (N)','Propelente (kg)','x (m)','z (m)','Pitch (°)','Roll (°)','Resultado / causa'],trajectory,[27,17,17,23,19,...Array(9).fill(17),43],COLORS.cyan);
  const zoneRows=[];
  for (const side of sides) {
    const plan=l.plans[side],grid=c[side].grid || {};
    const metadata=plan?Object.fromEntries(Object.entries(plan).filter(([k])=>k!=='zones')):{state:'No hay plan: fuente/DEM no disponible'};
    for (const [path,value] of leaves(metadata)) zoneRows.push([label[side],'Metadato '+path,'No aplica: metadato',val(value),'No aplica: metadato','No aplica: metadato','No aplica: metadato','No aplica: metadato','No aplica: metadato','No aplica: metadato',text(c[side].center),'Contexto de su propio DEM; no homología automática']);
    for (const [path,value] of leaves(grid)) zoneRows.push([label[side],'dataset.'+path,'No aplica: metadato',val(value),'No aplica: metadato','No aplica: metadato','No aplica: metadato','No aplica: metadato','No aplica: metadato','No aplica: metadato',text(c[side].center),'Resolución nativa, efectiva y cobertura son distintas; escala regional']);
    for (const z of plan?.zones || []) zoneRows.push([label[side],z.id,targetFirst && side==='earth'?'Referencia: sin descenso':z.id===plan.selectedId?'Selección del modelo':'Alternativa regional',val(z.score),val(z.status),val(z.x),val(z.z),val(z.slopeDeg),val(z.reliefM),val(z.scienceDistanceM),text(z.georeference),`${text(z.reason)}\nCobertura: ${val(z.coverage)} (0..1). Nativa: ${val(z.nativeResolutionMeters)} m; paso efectivo: ${val(z.spacingMeters)} m; vecindad: ${val(z.scaleMeters)} m. Máxima pendiente: ${val(z.maxSlopeDeg)}°. Elegible: ${val(z.eligible)}.`]);
    if (!plan?.zones?.length) zoneRows.push([label[side],'Sin candidatos','Sin selección','No evaluable: DEM/plan ausente','unevaluable',...Array(5).fill('No evaluable: sin candidato'), 'Sin georreferencia de candidato','No se fuerza contacto ni zona segura']);
    if (targetFirst) for (const [path,value] of leaves(l.explorationOrigins?.[side] || {state:side==='earth'?'Sin origen Tierra: espejo limitado; descenso objetivo independiente':'Sin contacto objetivo: no se habilita despliegue'})) zoneRows.push([label[side],'origin.'+path,side==='earth'?'Origen ensayo en superficie':'Contacto propio objetivo',value,...Array(6).fill('No aplica: metadato de origen'),text(c[side].center),'Georreferencia propia del cuerpo; espejo de movimiento relativo, sin homología']);
    for (const [path,value] of leaves(l.runs[side]?.georeference || {state:targetFirst && side==='earth'?noEarth:'No hay georreferencia: pose/DEM no disponible'})) zoneRows.push([label[side],'pose.'+path,'Pose al corte',value,...Array(6).fill('No aplica: georreferencia de pose'),text(c[side].center),'Pose de cada cuerpo exportada separadamente']);
  }
  add('Zona_ensayo','14 / PLAN REGIONAL','Candidatos regionales, ranking y razón. El centro científico es distinto del contacto. DEM remuestreado a 37.5 m no resuelve patas, rocas, paredes ni el pozo de Marius.',
    ['Cuerpo','ID / campo','Selección / ámbito','Score / valor','Estado','x (m)','z (m)','Pendiente (°)','Relieve (m)','Distancia ciencia (m)','Georreferencia / centro','Razón / limitación'],zoneRows,[23,37,27,30,24,19,19,19,19,22,42,62],COLORS.acid);
}
