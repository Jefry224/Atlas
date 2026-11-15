#!/usr/bin/env python3
"""Render actual XLSX through LibreOffice, then preserve full-page evidence and text coverage."""
import argparse,json,os,re,subprocess,unicodedata
from pathlib import Path
import pymupdf
from openpyxl import load_workbook
p=argparse.ArgumentParser();p.add_argument('--soffice',default='libreoffice');p.add_argument('--lib-path');p.add_argument('--profile',default='/tmp/selene-lo/render-profile');p.add_argument('--verify-only',action='store_true');p.add_argument('files',nargs='*');a=p.parse_args()
root=Path(__file__).resolve().parents[1];dest=root/'docs/evidencias/m2-excel-diseno';out=dest/'render-libreoffice';out.mkdir(exist_ok=True)
files=[Path(x).resolve() for x in a.files] if a.files else sorted(dest.glob('Atlas-M2-*.xlsx'))
env=dict(os.environ,SAL_USE_VCLPLUGIN='svp');
if a.lib_path:env['LD_LIBRARY_PATH']=a.lib_path
cmd=[a.soffice,f'-env:UserInstallation={Path(a.profile).as_uri()}','--headless','--convert-to','pdf','--outdir',str(out),*[str(f) for f in files]]
if not a.verify_only:
 r=subprocess.run(cmd,env=env,text=True,capture_output=True,timeout=180);(dest/'libreoffice-render.log').write_text(r.stdout+'\n'+r.stderr);assert r.returncode==0,(r.returncode,r.stdout,r.stderr)
norm=lambda s:re.sub(r'\s+','',unicodedata.normalize('NFKC',s).replace('\u00ad',''))
report=[]
for file in files:
 pdf=out/(file.stem+'.pdf');doc=pymupdf.open(pdf);text='\n'.join(page.get_text() for page in doc)
 (out/(file.stem+'.txt')).write_text('\n'.join(line.rstrip(' \t\r') for line in text.split('\n')).rstrip('\n')+'\n')
 # Check all supplied text cells survive Calc's print layout, not only package structure.
 w=load_workbook(file);missing=[];checked=0;normalizedText=norm(text)
 for sheet in w:
  for row in sheet:
   for cell in row:
    if isinstance(cell.value,str) and cell.value:
     checked+=1
     if norm(cell.value) not in normalizedText:missing.append({'sheet':sheet.title,'cell':cell.coordinate,'value':cell.value})
 pages=[]
 for i,page in enumerate(doc):
  # Full printed pages, never idealized HTML; the page text identifies the worksheet.
  png=out/f'{file.stem}-p{i+1:02}.png';page.get_pixmap(matrix=pymupdf.Matrix(1.25,1.25)).save(png)
  pages.append({'page':i+1,'png':png.name,'textLength':len(page.get_text()),'sizePt':[page.rect.width,page.rect.height]})
 report.append({'file':file.name,'renderer':'LibreOffice Calc 24.2.7.2','pdf':str(pdf.relative_to(root)),'pages':pages,'textCellsChecked':checked,'textNotFound':missing})
previous=json.loads((dest/'render-validation.json').read_text()) if (dest/'render-validation.json').exists() else []
combined={r['file']:r for r in previous};combined.update({r['file']:r for r in report})
(dest/'render-validation.json').write_text(json.dumps(sorted(combined.values(),key=lambda r:r['file']),ensure_ascii=False,indent=2)+'\n');print(json.dumps([{'file':r['file'],'pages':len(r['pages']),'textCellsChecked':r['textCellsChecked'],'textNotFound':len(r['textNotFound'])} for r in report],indent=2))

assert all(not r['textNotFound'] for r in report), 'Calc print clipping or missing text; see render-validation.json'
