#!/usr/bin/env python3
"""Local-only expedition QA server: static files + opt-in fault/provider fixtures, no external calls.
Run: python3 scripts/serve-earth-expedition-qa.py [port]. The query qa= selects a fixture.
"""
import json
import sys
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
REQUESTS = []


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def fixture(self):
        return (parse_qs(urlsplit(self.path).query).get('qa') or parse_qs(urlsplit(self.headers.get('Referer', '')).query).get('qa') or [''])[0]

    def reply(self, value, status=200):
        payload = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path, fixture = urlsplit(self.path).path, self.fixture()
        if fixture == 'webgl' and path == '/':
            html = (ROOT / 'index.html').read_text().replace('<head>', '<head><script>const ctx=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:ctx.call(this,type,...args)};</script>').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return
        if path == '/__qa/requests':
            return self.reply(REQUESTS)
        if fixture == 'copilot' and path == '/api/health':
            return self.reply({'status': 'ok', 'version': 'local-qa-fixture', 'providers': {'ai': 'openai'}})
        if fixture == 'missing-earth' and path.endswith('/dumont.json'):
            return self.reply({'error': 'qa-missing-earth'}, 404)
        if fixture == 'missing-target' and path.endswith('/targets/jezero.json'):
            return self.reply({'error': 'qa-missing-target'}, 404)
        if fixture == 'delayed' and path.endswith('/earth/atacama.json'):
            time.sleep(1.4)
        if fixture == 'delayed' and path.endswith('/targets/jezero.json'):
            time.sleep(1.1)
        return super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != '/api/copilot' or self.fixture() != 'copilot':
            return self.reply({'error': 'no-provider'}, 503)
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
        REQUESTS.append(body)
        if 'delayed' in body.get('question', '').lower():
            time.sleep(2.5)
        context = body.get('context', {})
        earth = context.get('earthExpedition') or {}
        return self.reply({'answer': 'QA provider fixture for ' + earth.get('site', {}).get('id', context.get('scenario', {}).get('id', 'catalogue')),
                           'provider': 'openai', 'generatedAt': datetime.now(timezone.utc).isoformat(),
                           'grounded': ['earthExpedition.sessionId'] if earth else [],
                           'disclaimer': 'Local fixture for transport and identity checks, not an AI response.'})

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8248
    print(f'Expedition QA at http://localhost:{port}/ (loopback only)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
