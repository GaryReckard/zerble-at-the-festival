"""Dev-only static server that disables HTTP caching so module reloads pick up
edited files. Plain `python3 -m http.server` sends Last-Modified but no
Cache-Control, and Chrome's heuristic cache happily holds ES module bodies.

Also exposes a tiny capture sink: `POST /__capture/<name>` writes the request
body to `.claude/captures/<name>.json`. This is the browser->repo bridge — the
running game (which can't write files) hands data to the dev server (which can),
so an agent that can't see the browser can read what the game captured. Pair
with `__dbg.capture(name?, data?)` in the console. Dev-only and loopback-only by
default; explicit `--lan` mode protects remote writes with a generated token."""

import argparse
import ipaddress
import re
import secrets
import socket
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlsplit

CAPTURE_DIR = Path(__file__).resolve().parent / 'captures'
MAX_CAPTURE_BYTES = 32 * 1024 * 1024
CAPTURE_TOKEN = None


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Same-origin POSTs from the game don't need CORS, but be permissive so
        # a capture from any local tab just works.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Zerble-Capture-Token')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        parsed = urlsplit(self.path)
        m = re.fullmatch(r'/__capture/([A-Za-z0-9_-]{1,64})', parsed.path)
        if not m:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'capture path must be /__capture/<name> (name chars: A-Za-z0-9_-)')
            return
        request_host = urlsplit('//' + (self.headers.get('Host') or '')).hostname or ''
        try:
            request_is_loopback = ipaddress.ip_address(request_host).is_loopback
        except ValueError:
            request_is_loopback = request_host == 'localhost'
        supplied_token = self.headers.get('X-Zerble-Capture-Token') or parse_qs(parsed.query).get('token', [''])[0]
        if CAPTURE_TOKEN and not request_is_loopback and not secrets.compare_digest(supplied_token, CAPTURE_TOKEN):
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'capture token required')
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


def local_ipv4_addresses():
    addresses = set()
    try:
        for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addresses.add(item[4][0])
    except OSError:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(('192.0.2.1', 9))
        addresses.add(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    return sorted(a for a in addresses if not ipaddress.ip_address(a).is_loopback)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='No-cache Zerble dev server with an ignored JSON capture sink.')
    parser.add_argument('port', nargs='?', type=int, default=8765)
    parser.add_argument('--lan', action='store_true', help='listen on the LAN and require a generated token for remote capture writes')
    args = parser.parse_args()
    port = args.port
    host = '0.0.0.0' if args.lan else '127.0.0.1'
    if args.lan:
        CAPTURE_TOKEN = secrets.token_urlsafe(18)
    server = ThreadingHTTPServer((host, port), NoCacheHandler)
    print(f'serving on http://127.0.0.1:{port} (no-cache, +/__capture sink)', flush=True)
    if args.lan:
        params = urlencode({'perfCapture': '1', 'captureToken': CAPTURE_TOKEN})
        addresses = local_ipv4_addresses()
        if addresses:
            print('phone/iPad playtest URLs:', flush=True)
            for address in addresses:
                print(f'  http://{address}:{port}/?{params}', flush=True)
        else:
            print(f'LAN mode is active. Open http://<this-mac-ip>:{port}/?{params}', flush=True)
        print('LAN capture writes require the token embedded in those URLs.', flush=True)
    server.serve_forever()
