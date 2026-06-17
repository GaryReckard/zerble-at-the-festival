"""Dev-only static server that disables HTTP caching so module reloads pick up
edited files. Plain `python3 -m http.server` sends Last-Modified but no
Cache-Control, and Chrome's heuristic cache happily holds ES module bodies.

Also exposes a tiny capture sink: `POST /__capture/<name>` writes the request
body to `.claude/captures/<name>.json`. This is the browser->repo bridge — the
running game (which can't write files) hands data to the dev server (which can),
so an agent that can't see the browser can read what the game captured. Pair
with `__dbg.capture(name?, data?)` in the console. Dev-only, localhost-only."""

import re
import sys
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

CAPTURE_DIR = Path(__file__).resolve().parent / 'captures'
MAX_CAPTURE_BYTES = 32 * 1024 * 1024


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Same-origin POSTs from the game don't need CORS, but be permissive so
        # a capture from any local tab just works.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        m = re.fullmatch(r'/__capture/([A-Za-z0-9_-]{1,64})', self.path)
        if not m:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'capture path must be /__capture/<name> (name chars: A-Za-z0-9_-)')
            return
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0 or length > MAX_CAPTURE_BYTES:
            self.send_response(413)
            self.end_headers()
            return
        body = self.rfile.read(length)
        CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
        out = CAPTURE_DIR / f'{m.group(1)}.json'
        out.write_bytes(body)
        print(f'[capture] wrote {out} ({length} bytes)')
        self.send_response(200)
        self.end_headers()
        self.wfile.write(f'wrote {out.name} ({length} bytes)'.encode())


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler)
    print(f'serving on http://127.0.0.1:{port} (no-cache, +/__capture sink)')
    server.serve_forever()
