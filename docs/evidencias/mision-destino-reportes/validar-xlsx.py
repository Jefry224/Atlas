#!/usr/bin/env python3
"""Lector independiente de reportes target-first; admite descargas UI JSON/XLSX emparejadas."""
import argparse,json,math,os,re,subprocess,zipfile
from pathlib import Path
from openpyxl import load_workbook

parser=argparse.ArgumentParser();parser.add_argument('files',nargs='*');parser.add_argument('--render',action='store_true');args=parser.parse_args()
dest=Path(__file__).resolve().parent;root=dest.parents[2]
paths=[Path(p).resolve() for p in args.files] if args.files else sorted(dest.glob('Atlas-destino-*.xlsx'))
expected=['Resumen','Mision','Datos_y_origen','Historial_rover','Historial_clima','Matriz_ruptura','Calibracion','Termica','Herramientas','Recursos_NASA','Fuentes','Limites_eventos','Descenso','Trayectoria','Zona_ensayo']
reports=[]
for path in paths:
    w=load_workbook(path,data_only=False);assert w.sheetnames==expected,(path,w.sheetnames)
    assert len(w['Resumen']._charts)==1
    assert {s.val.numRef.f for s in w['Resumen']._charts[0].series}=={"'Resumen'!$B$25:$B$26","'Resumen'!$C$25:$C$26"}
    count=0
    for sheet in w:
        if sheet.title!='Resumen':
            assert sheet.freeze_panes=='A7' and sheet.auto_filter.ref.startswith('A6:')
            assert sheet.print_title_rows=='$6:$6' and sheet.print_area
            assert sheet['A1'].fill.fgColor.rgb=='FF07173F'
        for row in sheet:
            for cell in row:
                assert cell.data_type not in ('f','e'),(sheet.title,cell.coordinate,cell.value)
                if cell.row>=7 and sheet.title!='Resumen':
                    assert cell.value is not None and str(cell.value).strip(),(sheet.title,cell.coordinate,'blank')
                    assert not re.search(r'\b(null|undefined|NaN|Infinity)\b',str(cell.value)),(sheet.title,cell.coordinate,cell.value)
                    if isinstance(cell.value,(float,int)):assert math.isfinite(cell.value) and cell.data_type=='n' and cell.number_format!='General'
                    count+=1
    assert w['Descenso']['C6'].value=='Objetivo principal / dato'
    assert 'Tierra análogo' in w['Descenso']['D6'].value
    assert 'No aplica: sin descenso terrestre' in w['Resumen']['A17'].value
    rows=list(w['Descenso'].values)[6:]
    assert next(r[3] for r in rows if r[0]=='runs' and r[1]=='Fase física')=='No aplica: sin descenso terrestre'
    trajectory=list(w['Trayectoria'].values)[6:]
    assert all(row[3].startswith('Objetivo principal') for row in trajectory)
    assert any('sin instrumentos conectados' in str(c.value) for row in w['Descenso'] for c in row)
    assert 'Clima de Tierra' in w['Historial_clima']['A4'].value
    source=path.with_suffix('.json')
    if not source.exists():source=path.with_name(path.stem+'-dossier.json')
    checked_json=False
    if source.exists():
        d=json.loads(source.read_text());l=d.get('landing') or d.get('mission',{}).get('landing');assert l
        assert l['missionMode']=='target-first' and l['primarySide']=='target' and l['runs']['earth'] is None
        assert all(h['earth'] is None for h in l['history'])
        if 'mission' in d:assert l==d['mission']['landing'] and l['missionId']==d['mission']['id']
        assert len(trajectory)==sum(h['target'] is not None for h in l['history'])
        for row,h in zip(trajectory,(h for h in l['history'] if h['target'] is not None)):
            assert row[0]==h['utc'] and row[1]==h['simSeconds'] and row[2]==h['target']['simSeconds']
            assert row[4]==h['target']['phase'] and row[5]==h['target']['altitudeM']
        for key,label in [('phase','Fase física'),('simSeconds','Tiempo descenso SIM'),('propellantKg','Propelente restante'),('x','Contacto / pose x')]:
            assert next(r[2] for r in rows if r[0]=='runs' and r[1]==label)==l['runs']['target'][key]
        for side,role in [('earth','analogue-test-origin'),('target','target-contact')]:
            if l['explorationOrigins'][side]:assert l['explorationOrigins'][side]['role']==role
        checked_json=True
    with zipfile.ZipFile(path) as z:assert z.testzip() is None
    report={'file':str(path.relative_to(root)),'reader':'openpyxl '+__import__('openpyxl').__version__,'sheets':len(w.sheetnames),'checkedCells':count,'dataBlanks':0,'badNumbers':0,'formulas':0,'trajectoryRows':len(trajectory),'chartReferences':'preserved','pairedJSON':checked_json}
    if args.render:
        import pymupdf
        out=dest/'render-calc';out.mkdir(exist_ok=True)
        env=dict(os.environ,SAL_USE_VCLPLUGIN='svp',LD_LIBRARY_PATH='/tmp/selene-lo/root/usr/lib/libreoffice/program:/tmp/selene-lo/root/usr/lib/x86_64-linux-gnu')
        result=subprocess.run(['/tmp/selene-lo/root/usr/lib/libreoffice/program/soffice','-env:UserInstallation=file:///tmp/selene-lo/target-first-report-profile','--headless','--convert-to','pdf','--outdir',str(out),str(path)],env=env,capture_output=True,text=True,timeout=120)
        (out/(path.stem+'-calc.log')).write_text(result.stdout+'\n'+result.stderr);assert result.returncode==0,result.stderr
        pdf=out/(path.stem+'.pdf');doc=pymupdf.open(pdf)
        text='\n'.join(page.get_text() for page in doc);(out/(path.stem+'.txt')).write_text(text)
        normalized=lambda s:re.sub(r'\s+','',str(s).replace('\u00ad',''))
        alltext=normalized(text)
        # Revisión de recorte textual en las tres hojas añadidas y resumen de misión.
        missing=[]
        for name in expected[-3:]:
            for row in w[name]:
                for cell in row:
                    if isinstance(cell.value,str) and cell.value and normalized(cell.value) not in alltext:missing.append({'sheet':name,'cell':cell.coordinate,'text':cell.value})
        assert normalized(w['Resumen']['A17'].value) in alltext,'Cover text clipped'
        captures=[]
        for name in ['Resumen','Descenso','Trayectoria','Zona ensayo']:
            page_index=0 if name=='Resumen' else next(i for i,page in enumerate(doc) if re.search(r'(?m)^'+re.escape(name)+r'\s*/\s*',page.get_text()))
            png=out/(path.stem+'-'+name.replace(' ','_')+'.png');doc[page_index].get_pixmap(matrix=pymupdf.Matrix(1.1,1.1)).save(png);captures.append(str(png.relative_to(root)))
        report.update(renderer='LibreOffice Calc (XLSX real)',pdfPages=len(doc),textNotFound=missing,captures=captures)
    reports.append(report)
reportpath=dest/'validacion-xlsx.json'
prior=json.loads(reportpath.read_text()) if reportpath.exists() else []
combined={r['file']:r for r in prior};combined.update({r['file']:r for r in reports})
reportpath.write_text(json.dumps(list(combined.values()),ensure_ascii=False,indent=2)+'\n')
print(json.dumps([{k:(len(v) if k in ('textNotFound','captures') else v) for k,v in r.items()} for r in reports],ensure_ascii=False,indent=2))
assert not any(r.get('textNotFound') for r in reports),'Texto recortado en Calc; consultar validacion-xlsx.json'
