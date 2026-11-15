#!/usr/bin/env python3
"""Independent OOXML consumer validation. Requires openpyxl in an isolated environment."""
import json,sys,zipfile
from pathlib import Path
from openpyxl import load_workbook
root=Path(__file__).resolve().parents[1];path=Path(sys.argv[1]) if len(sys.argv)>1 else root/'docs/evidencias/m2-automatico/Atlas-M2-mision-real.xlsx'
w=load_workbook(path,data_only=False)
expected=['Resumen','Mision','Datos_y_origen','Historial_rover','Historial_clima','Matriz_ruptura','Calibracion','Termica','Herramientas','Recursos_NASA','Fuentes','Limites_eventos']
assert w.sheetnames==expected,w.sheetnames
for s in w:
 assert s.max_row>1,s.title
 assert s.freeze_panes=='A2',s.title
 assert s.auto_filter.ref,s.title
 assert all(c.data_type!='f' for row in s for c in row),'Formula found'
cal={row[1]:row[2] for row in list(w['Calibracion'].values)[1:]}
assert cal['Masa original']==350 and cal['Peso objetivo']==567
assert any(r[0]=='offload' and r[1]=='Soporte vertical' and abs(r[2]-2866.5)<1e-8 for r in list(w['Calibracion'].values)[1:])
assert isinstance(cal['Masa ensayo'],(float,int))
assert w['Historial_rover'].max_row>=3
assert any(isinstance(row[8],(int,float)) and row[8]>0 for row in list(w['Historial_rover'].values)[1:])
assert w['Historial_clima'].max_row>=2
assert any(isinstance(row[8],(int,float)) and row[8]>0 for row in list(w['Historial_clima'].values)[1:])
origins={row[0]:row for row in list(w['Datos_y_origen'].values)[1:]}
assert origins['surfaceK'][1]=='Sin dato' and origins['surfaceK'][3]=='missing'
assert origins['massKg'][4]=='prototype-config'
assert w['Recursos_NASA'].max_row==10
assert any('Visual únicamente' in str(row) for row in w['Recursos_NASA'].values)
with zipfile.ZipFile(path) as z:
 assert z.testzip() is None
 report={'reader':'openpyxl '+__import__('openpyxl').__version__,'file':str(path.relative_to(root)),'sheets':{s.title:{'rows':s.max_row,'columns':s.max_column,'freeze':s.freeze_panes,'filter':s.auto_filter.ref} for s in w},'checks':['12 hojas útiles','archivo ZIP CRC íntegro','números numéricos','masa/peso/modos correctos','rover avanzó','presión Pa real','nulos con razones','9 recursos visuales','sin fórmulas','filtros/freeze en todas hojas']}
fixture=root/'docs/evidencias/m2-automatico/strings-seguras.xlsx'
if fixture.exists():
 f=load_workbook(fixture,data_only=False)['Prueba']
 assert f['A2'].value=='=HYPERLINK("evil")' and f['A2'].data_type=='s'
 assert f['A3'].value=='+cmd' and f['A4'].value=='@SUM(A1)' and f['A5'].value=='-malicioso'
 assert f['B2'].data_type=='n' and f['B4'].value==-3
 assert f['B5'].value=='Luna 🌙 & < >'
 report['checks'].append('Unicode/XML/control chars/formula strings: lector independiente conserva texto y números')
out=root/'docs/evidencias/m2-automatico/xlsx-validation.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
