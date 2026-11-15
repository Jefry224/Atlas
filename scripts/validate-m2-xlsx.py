#!/usr/bin/env python3
"""Independent openpyxl/OOXML audit for Mission Control dossiers (no renderer claims)."""
import json, math, re, sys, zipfile, posixpath, xml.etree.ElementTree as ET
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.cell.cell import MergedCell
root=Path(__file__).resolve().parents[1]
dest=root/'docs/evidencias/m2-excel-diseno'
paths=[Path(x) for x in sys.argv[1:]] if len(sys.argv)>1 else sorted(dest.glob('Atlas-M2-*.xlsx'))
expected=['Resumen','Mision','Datos_y_origen','Historial_rover','Historial_clima','Matriz_ruptura','Calibracion','Termica','Herramientas','Recursos_NASA','Fuentes','Limites_eventos']
reports=[]
for path in paths:
 w=load_workbook(path,data_only=False);assert w.sheetnames==expected,(path,w.sheetnames)
 assert len(w['Resumen']._charts)==1,path
 assert not w['Resumen'].auto_filter.ref
 assert w['Resumen']['A1'].value=='S.E.L.E.N.E / ATLAS'
 assert any(c.hyperlink and c.hyperlink.location=="'Herramientas'!A1" for row in w['Resumen'] for c in row)
 count=0
 for sheet in w:
  assert sheet.print_area,sheet.title
  assert sheet.sheet_view.showGridLines is False
  assert sheet.sheet_properties.tabColor
  assert sheet.page_setup.fitToWidth==1
  assert sheet.column_dimensions['A'].width>15
  for row in sheet:
   for c in row:
    assert c.data_type!='f',(sheet.title,c.coordinate,'formula')
    if c.value is not None:
     assert not re.search(r'\b(null|undefined|NaN|Infinity)\b',str(c.value)),(sheet.title,c.coordinate,c.value)
  if sheet.title=='Resumen':continue
  assert sheet.freeze_panes=='A7'
  assert sheet.auto_filter.ref==f'A6:{sheet.cell(6,sheet.max_column).column_letter}{sheet.max_row}'
  assert sheet.print_title_rows=='$6:$6'
  assert sheet['A1'].fill.fgColor.rgb=='FF07173F'
  assert sheet['A6'].font.color.rgb=='FFFFFFFF'
  for row in sheet.iter_rows(min_row=7):
   for c in row:
    assert not isinstance(c,MergedCell),(sheet.title,c.coordinate)
    assert c.value is not None and str(c.value).strip(),(path.name,sheet.title,c.coordinate,'empty data')
    if isinstance(c.value,(float,int)):assert math.isfinite(c.value);assert c.data_type=='n';assert c.number_format!='General'
    count+=1
 cal=list(w['Calibracion'].values)[6:]
 val=lambda label:next(row[2] for row in cal if row[1]==label)
 assert val('Masa original')==350
 target=val('Peso objetivo');assert target in (567,1298.5)
 assert math.isclose(val('Peso terrestre'),3433.5)
 assert math.isclose(next(r[2] for r in cal if r[0]=='offload' and r[1]=='Soporte vertical'),3433.5-target)
 assert next(r[2] for r in cal if r[0]=='equivalent' and r[1]=='Soporte vertical')==0
 assert math.isclose(val('Masa ensayo'),target/9.81)
 if target==567:assert val('Razón inversa')=='No aplica: vacío ideal / división por cero'
 origins={r[0]:r for r in list(w['Datos_y_origen'].values)[6:]}
 if '-Mission-Control.xlsx' in path.name:
  assert 'archive' in w['Resumen']['A7'].value
  assert next(w['Historial_clima'].iter_rows(min_row=7,values_only=True))[3]=='snapshot'
  assert 'No registrado' in w['Historial_rover']['B7'].value
 if 'descarga-UI-real' in path.name:
  assert isinstance(origins['earthPressurePa'][2],(int,float)) and origins['earthPressurePa'][2]>0
  assert 'weather-model' in origins['earthPressurePa'][4]
  assert re.match(r'\d{4}-\d{2}-\d{2}T',origins['earthPressurePa'][6])
 if 'offline-parcial' in path.name:
  assert w['Historial_rover']['B7'].value==0 and w['Historial_rover']['C7'].value==0
  assert 'Pendiente' in origins['earthPressurePa'][2]
 tools=list(w['Herramientas'].values)[6:];assert len(set(r[0] for r in tools))==8
 assert any('included-in-rover' in row[1] for row in tools)
 assert any('external-kit' in row[1] for row in tools)
 assert any('test-equipment' in row[1] for row in tools)
 assert all(row[3] is not None and row[7]=='docs/modules/perfiles-base-m2.md' for row in tools)
 thermal=list(w['Termica'].values)[6:];t={r[0]:r for r in thermal}
 area=t['Área de intercambio'][1];ts=t['Setpoint superficie del equipo'][1];env=t['Setpoint entorno del banco'][1];h=t['Coeficiente convectivo del banco'][1];eps=t['Emisividad asumida'][1]
 assert isinstance(t['Gas del banco (T_aire)'][1],(float,int)) and t['Gas del banco (T_aire)'][1]==env
 assert math.isclose(t['Q convección'][1],h*area*(ts-env),abs_tol=1e-10)
 assert math.isclose(t['Q radiación'][1],eps*5.670374419e-8*area*(ts**4-env**4),rel_tol=1e-10)
 assert 'incompleto' in t['Q radiación'][2]
 if 'polar-shadow' in path.name:assert t['Q convección'][1]==0 and h==0
 assert 'Precipitación' not in str(list(w['Historial_clima'].values)[5])
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  for name in z.namelist():
   if not name.endswith('.rels'):continue
   for rel in ET.fromstring(z.read(name)):
    assert rel.attrib.get('TargetMode')!='External'
    base=posixpath.dirname(posixpath.dirname(name))
    target=posixpath.normpath(posixpath.join(base,rel.attrib['Target']))
    assert target in z.namelist(),(name,target)
  chart=ET.fromstring(z.read('xl/charts/chart1.xml'));ns={'c':'http://schemas.openxmlformats.org/drawingml/2006/chart'}
  assert len(chart.findall('.//c:ser',ns))==2
  assert {f.text for f in chart.findall('.//c:f',ns)}=={"'Resumen'!$A$25:$A$26","'Resumen'!$B$25:$B$26","'Resumen'!$C$25:$C$26"}
 reports.append({'file':str(path.relative_to(root)),'sheets':12,'instrumentParameters':len(tools),'checkedDataCells':count,'nativeCharts':1,'CRC':'OK','relationships':'OK','dataBlanks':0,'badNumbers':0,'cellFormulas':0,'baseConvectionW':t['Q convección'][1],'baseRadiationW':t['Q radiación'][1],'roverRows':w['Historial_rover'].max_row-6,'weatherRows':w['Historial_clima'].max_row-6})
f=load_workbook(dest/'strings-seguras.xlsx')['Prueba']
assert [f[f'A{i}'].value for i in range(2,6)]==['=HYPERLINK("evil")','+cmd','@SUM(A1)','-malicioso']
assert all(f[f'A{i}'].data_type=='s' for i in range(2,6))
assert f['B2'].value==42 and f['B4'].value==-3 and f['B5'].value=='Luna 🌙 & < >'
report={'reader':'openpyxl '+__import__('openpyxl').__version__,'checks':'styles / print / frozen table at A6 / native chart / archive sources / no data blanks / correct numbers / text safety / complete proposed instruments','files':reports}
(dest/'xlsx-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
