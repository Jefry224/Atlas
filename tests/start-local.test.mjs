import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLaunch } from '../scripts/start-local.mjs';

test('dev serves web and API from one origin with explicit default port and reload', () => {
  const launch = buildLaunch(['--reload'], '/atlas', {}, () => false);
  assert.equal(launch.url, 'http://127.0.0.1:8000');
  assert.deepEqual(launch.pythonArgs, ['-m', 'uvicorn', 'server.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload']);
  assert.equal(launch.needsDotenv, false);
});

test('local .env loads automatically and an explicit env file keeps precedence', () => {
  const automatic = buildLaunch([], '/atlas', {}, () => true);
  assert.deepEqual(automatic.pythonArgs.slice(-2), ['--env-file', '/atlas/.env']);
  assert.equal(automatic.needsDotenv, true);
  const explicit = buildLaunch(['--env-file', 'custom.env'], '/atlas', {}, () => true);
  assert.deepEqual(explicit.pythonArgs.slice(-2), ['--env-file', 'custom.env']);
  assert.equal(explicit.pythonArgs.filter(arg => arg === '--env-file').length, 1);
});

test('port override, shared host and static positional port preserve their launch modes', () => {
  assert.equal(buildLaunch(['--port', '8027'], '/atlas', { PORT: '8010' }, () => false).url, 'http://127.0.0.1:8027');
  assert.equal(buildLaunch(['--port=8027', '--host', '0.0.0.0'], '/atlas', {}, () => false).url, 'http://localhost:8027');
  const staticLaunch = buildLaunch(['--static', '8028'], '/atlas', {}, () => true);
  assert.deepEqual(staticLaunch.pythonArgs, ['-m', 'http.server', '8028', '--bind', '127.0.0.1']);
  assert.equal(staticLaunch.needsDotenv, false);
  for (const args of [['--port'], ['--port', '0'], ['--port', '65536'], ['--port', 'abc'], ['--host']]) {
    assert.throws(() => buildLaunch(args, '/atlas', {}, () => false));
  }
});
