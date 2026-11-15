// Lanza backend + frontend del mismo origen. No instala dependencias automáticamente.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2), staticMode=args.includes('--static');
const pythonCandidates=[process.env.ATLAS_PYTHON,join(root,'.venv-server',process.platform==='win32'?'Scripts/python.exe':'bin/python'),'python3','python'].filter(Boolean);
const python=pythonCandidates.find(p=>(!p.includes('/')||existsSync(p))&&spawnSync(p,['-c',staticMode?'import http.server':'import fastapi, uvicorn, httpx'],{stdio:'ignore'}).status===0);
if(!python){console.error('Faltan dependencias de backend. Preparar desde Atlas:\npython3 -m venv .venv-server\n.venv-server/bin/python -m pip install -r server/requirements.txt\nDespués: npm start -- --port 8027\nSin API: npm run start:static');process.exit(1);}
const rest=args.filter(a=>a!=='--static');
const child=spawn(python,staticMode?['-m','http.server',...(rest.length?rest:['8000'])]:['-m','uvicorn','server.main:app','--host','127.0.0.1',...(rest.length?rest:['--port','8000'])],{cwd:root,stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1)); child.on('error',error=>{console.error(error.message);process.exit(1);});
