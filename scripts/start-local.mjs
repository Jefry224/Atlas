// One origin for API and web; dependency setup stays in the local virtual environment.
// shortcut: inherited Spanish launcher copy remains until the localization pass.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function buildLaunch(args, root = ROOT, env = process.env, exists = existsSync) {
  const staticMode = args.includes('--static');
  const rest = [];
  let port = env.PORT || '8000', host = '127.0.0.1';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--static') continue;
    if (arg === '--port') { port = args[++i]; continue; }
    if (arg.startsWith('--port=')) { port = arg.slice(7); continue; }
    if (arg === '--host' || arg === '--bind') { host = args[++i]; continue; }
    if (arg.startsWith('--host=')) { host = arg.slice(7); continue; }
    if (staticMode && /^\d+$/.test(arg)) { port = arg; continue; }
    rest.push(arg);
  }
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Puerto inválido. Usá --port con un número de 1 a 65535.');
  }
  if (typeof host !== 'string' || !host.trim()) throw new Error('Falta el valor de --host.');
  const explicitEnv = rest.some(arg => arg === '--env-file' || arg.startsWith('--env-file='));
  if (!staticMode && !explicitEnv && exists(join(root, '.env'))) rest.push('--env-file', join(root, '.env'));
  const connectHost = ['0.0.0.0', '::'].includes(host) ? 'localhost' : host;
  return {
    staticMode,
    url: `http://${connectHost.includes(':') ? `[${connectHost}]` : connectHost}:${Number(port)}`,
    needsDotenv: !staticMode && rest.some(arg => arg === '--env-file' || arg.startsWith('--env-file=')),
    pythonArgs: staticMode
      ? ['-m', 'http.server', String(Number(port)), '--bind', host, ...rest]
      : ['-m', 'uvicorn', 'server.main:app', '--host', host, '--port', String(Number(port)), ...rest],
  };
}

function preparePython(config) {
  const localPython = join(ROOT, '.venv-server', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const candidates = process.env.ATLAS_PYTHON
    ? [process.env.ATLAS_PYTHON]
    : [join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), localPython, 'python3', 'python'];
  const works = (python, code) => spawnSync(python, ['-c', code], { stdio: 'ignore', timeout: 15000 }).status === 0;
  const imports = config.staticMode ? 'import http.server' : `import fastapi, uvicorn, httpx${config.needsDotenv ? ', dotenv' : ''}`;
  const ready = candidates.find(python => works(python, imports));
  if (ready) return ready;
  const python = candidates.find(candidate => works(candidate, 'import sys'));
  if (!python) throw new Error('No se encontró Python. Instalá Python 3 con soporte venv o configurá ATLAS_PYTHON.');
  if (config.staticMode) throw new Error('El intérprete seleccionado no dispone de http.server.');
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('No se pudo preparar el backend. Revisá la salida anterior; se requiere Python con venv y acceso al registro de paquetes durante la primera instalación.');
  };
  if (!existsSync(localPython)) {
    console.log('Preparando el entorno local .venv-server…');
    run(python, ['-m', 'venv', join(ROOT, '.venv-server')]);
  }
  console.log('Instalando las dependencias del backend en .venv-server…');
  run(localPython, ['-m', 'pip', 'install', '-r', join(ROOT, 'server/requirements.txt')]);
  if (!works(localPython, imports)) throw new Error('Las dependencias del backend no están disponibles en .venv-server.');
  return localPython;
}

export function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Atlas · API + web\n\nnpm run dev                       API y web con recarga del backend\nnpm run dev -- --port 8001         Elegir otro puerto\nnpm start                         API y web sin recarga\nnpm run start:static -- 8028       Solo web con datos de archivo\n\nLa primera ejecución prepara .venv-server si faltan dependencias.\nEl backend carga .env cuando existe. Ctrl+C detiene el servidor.');
    return;
  }
  try {
    const config = buildLaunch(args);
    const python = preparePython(config);
    console.log(`\nAtlas · ${config.staticMode ? 'web estática' : 'API + web'}\nWeb: ${config.url}/`);
    if (!config.staticMode) console.log(`API: ${config.url}/api/health\nDocumentación API: ${config.url}/api/docs`);
    console.log('Iniciando servidor. Dejá esta terminal abierta; Ctrl+C para detenerlo.\n');
    const child = spawn(python, config.pythonArgs, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PYTHONUNBUFFERED: '1' } });
    const signals = ['SIGINT', 'SIGTERM'];
    const stop = signal => child.kill(signal);
    for (const signal of signals) process.on(signal, stop);
    const cleanup = () => { for (const signal of signals) process.removeListener(signal, stop); };
    child.once('exit', (code, signal) => { cleanup(); process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
    child.once('error', error => { cleanup(); console.error(error.message); process.exitCode = 1; });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
