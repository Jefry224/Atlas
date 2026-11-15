#!/usr/bin/env python3
"""Independent openpyxl validation; optional actual Calc PDF/text/full-page render of landing sheets."""
import argparse,json,math,os,re,subprocess,unicodedata,zipfile
from pathlib import Path
from openpyxl import load_workbook
p=argparse.ArgumentParser();p.add_argument('files',nargs='*');p.add_argument('--render',action='store_true');p.add_argument('--verify-only',action='store_true');p.add_argument('--soffice',default='/tmp/selene-lo/root/usr/lib/libreoffice/program/soffice');a=p.parse_args()
root=Path(__file__).resolve().parents[1];dest=root/'docs/evidencias/descenso-informe';out=dest/'render-libreoffice';out.mkdir(exist_ok=True)
paths=[Path(x).resolve() for x in a.files] if a.files else sorted(dest.glob('Atlas-descenso-*.xlsx'))
expected=['Resumen','Mision','Datos_y_origen','Historial_rover','Historial_clima','Matriz_ruptura','Calibracion','Termica','Herramientas','Recursos_NASA','Fuentes','Limites_eventos','Descenso','Trayectoria','Zona_ensayo']
reports=[]
for path in paths:
 w=load_workbook(path,data_only=False);assert w.sheetnames==expected,(path,w.sheetnames)
 assert len(w['Resumen']._charts)==1
 assert 'DESCENSO /' in w['Resumen']['A17'].value
 chart=w['Resumen']._charts[0]
 assert {s.val.numRef.f for s in chart.series}=={"'Resumen'!$B$25:$B$26","'Resumen'!$C$25:$C$26"}
 count=0
 for sheet in w:
  if sheet.title!='Resumen':
   assert sheet.freeze_panes=='A7';assert sheet.auto_filter.ref.startswith('A6:');assert sheet.print_title_rows=='$6:$6'
   assert sheet['A6'].font.color.rgb=='FFFFFFFF';assert sheet['A1'].fill.fgColor.rgb=='FF07173F'
   assert sheet.print_area;assert sheet.page_setup.fitToWidth==1
  for row in sheet:
   for c in row:
    assert c.data_type!='f',(sheet.title,c.coordinate)
    if c.row>=7 and sheet.title!='Resumen':
     assert c.value is not None and str(c.value).strip(),(sheet.title,c.coordinate,'blank')
     assert not re.search(r'\b(null|undefined|NaN|Infinity)\b',str(c.value)),(sheet.title,c.coordinate,c.value)
     if isinstance(c.value,(float,int)):assert math.isfinite(c.value) and c.data_type=='n' and c.number_format!='General'
     count+=1
 source=path.with_suffix('.json')
 if not source.exists():source=path.with_name(path.stem+'-dossier.json')
 if source.exists():
  d=json.loads(source.read_text());l=d['landing'];assert l['missionId']==d['mission']['id'];assert l==d['mission']['landing'];assert l['scenarioId']==d['candidate']['scenario']['id']
  rows=list(w['Descenso'].values)[6:]
  for side,col in [('earth',2),('target',3)]:
   val=lambda section,key:next(r[col] for r in rows if r[0]==section and r[1]==key)
   assert val('profiles','Masa seca total')==l['profiles'][side]['dryMassKg'];assert val('profiles','Propelente inicial')==l['profiles'][side]['propellantKg']
   assert val('runs','Fase física')==l['runs'][side]['phase'];assert val('runs','Tiempo descenso SIM')==l['runs'][side]['simSeconds']
   for key,label in [('altitudeM','Altura AGL actual'),('propellantKg','Propelente restante'),('x','Contacto / pose x'),('z','Contacto / pose z')]:
    actual=val('runs',label);expected_value=l['runs'][side][key]
    if expected_value is None:assert actual.startswith('Pendiente:')
    else:assert actual==expected_value
  trajectory=list(w['Trayectoria'].values)[6:];assert len(trajectory)==len(l['history'])*2
  for i,h in enumerate(l['history']):
   for j,side in enumerate(['earth','target']):
    row=trajectory[i*2+j];assert row[0]==h['utc'];assert row[1]==h['simSeconds'];assert row[2]==h[side]['simSeconds'];assert row[4]==h[side]['phase']
  if path.name.startswith('Atlas-descenso-'):assert len(d['mission']['rover'])==0,'Engine fixture must not fabricate rover samples'
 with zipfile.ZipFile(path) as z:assert z.testzip() is None
 report={'file':str(path.relative_to(root)),'reader':'openpyxl '+__import__('openpyxl').__version__,'sheets':len(w.sheetnames),'checkedCells':count,'dataBlanks':0,'badNumbers':0,'formulas':0,'chartReferences':'preserved','trajectoryRows':w['Trayectoria'].max_row-6}
 reports.append(report)
if a.render:
 import pymupdf
 env=dict(os.environ,SAL_USE_VCLPLUGIN='svp',LD_LIBRARY_PATH='/tmp/selene-lo/root/usr/lib/libreoffice/program:/tmp/selene-lo/root/usr/lib/x86_64-linux-gnu')
 if not a.verify_only:
  result=subprocess.run([a.soffice,'-env:UserInstallation=file:///tmp/selene-lo/landing-report-profile','--headless','--convert-to','pdf','--outdir',str(out),*[str(f) for f in paths]],env=env,capture_output=True,text=True,timeout=240)
  (out/'calc-render.log').write_text(result.stdout+'\n'+result.stderr);assert result.returncode==0,result.stderr
 norm=lambda s:re.sub(r'\s+','',unicodedata.normalize('NFKC',s).replace('\u00ad',''))
 for path,report in zip(paths,reports):
  pdf=out/(path.stem+'.pdf');doc=pymupdf.open(pdf);alltext='\n'.join(p.get_text() for p in doc);(out/(path.stem+'.txt')).write_text(alltext)
  w=load_workbook(path);missing=[];checked=0;normalized=norm(alltext)
  for name in expected[-3:]:
   for row in w[name]:
    for c in row:
     if isinstance(c.value,str) and c.value:
      checked+=1
      if norm(c.value) not in normalized:missing.append({'sheet':name,'cell':c.coordinate,'value':c.value})
  assert norm(w['Resumen']['A17'].value) in normalized, 'Flight summary clipped in cover'
  report['coverFlightSummaryRendered']=True
  cover=out/f'{path.stem}-Resumen-p01.png';doc[0].get_pixmap(matrix=pymupdf.Matrix(1.25,1.25)).save(cover)
  captures=[{'sheet':'Resumen','page':1,'png':str(cover.relative_to(root))}]
  for name in ['Descenso','Trayectoria','Zona ensayo']:
   for i,page in enumerate(doc):
    if re.search(r'(?m)^'+re.escape(name)+r'\s*/\s*',page.get_text()):
     png=out/f'{path.stem}-{name.replace(" ","_")}-p{i+1:02}.png';page.get_pixmap(matrix=pymupdf.Matrix(1.25,1.25)).save(png);captures.append({'sheet':name,'page':i+1,'png':str(png.relative_to(root))});break
  for i,page in enumerate(doc):
   if 'Atlas · M2 / Zona_ensayo' in page.get_text() and 'Selección del modelo' in page.get_text():
    png=out/f'{path.stem}-candidatos-p{i+1:02}.png';page.get_pixmap(matrix=pymupdf.Matrix(1.25,1.25)).save(png);captures.append({'sheet':'Zona_ensayo / candidatos','page':i+1,'png':str(png.relative_to(root))});break
  for i,page in enumerate(doc):
   if 'Atlas · M2 / Descenso' in page.get_text() and 'outside-model-tolerances' in page.get_text():
    png=out/f'{path.stem}-resultado-fallo-p{i+1:02}.png';page.get_pixmap(matrix=pymupdf.Matrix(1.25,1.25)).save(png);captures.append({'sheet':'Descenso / resultado fallo','page':i+1,'png':str(png.relative_to(root))});break
  report.update(renderer='LibreOffice Calc (actual XLSX)',rendererProducer=doc.metadata.get('producer'),pdfPages=len(doc),newSheetTextCellsChecked=checked,textNotFound=missing,captures=captures)
reportpath=dest/'xlsx-independent-validation.json'
previous=json.loads(reportpath.read_text()) if reportpath.exists() else []
combined={r['file']:r for r in previous};combined.update({r['file']:r for r in reports})
reportpath.write_text(json.dumps(sorted(combined.values(),key=lambda r:r['file']),ensure_ascii=False,indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items() if k not in ('textNotFound','captures')}|{'textNotFound':len(r.get('textNotFound',[])),'captures':len(r.get('captures',[]))} for r in reports],indent=2))
assert all(not r.get('textNotFound') for r in reports),'Calc text clipping; see xlsx-independent-validation.json'
