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
import errno
import ipaddress
import posixpath
import re
import secrets
import socket
import subprocess
import sys
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlencode, urlsplit

CAPTURE_DIR = Path(__file__).resolve().parent / 'captures'
MAX_CAPTURE_BYTES = 32 * 1024 * 1024
CAPTURE_TOKEN = None
LAN_MODE = False
PUBLIC_FILES = {
    '/', '/index.html', '/styles.css', '/favicon.ico', '/favicon.svg',
    '/favicon-96x96.png', '/apple-touch-icon.png', '/site.webmanifest',
    '/web-app-manifest-192x192.png', '/web-app-manifest-512x512.png',
}


def public_game_path(raw_path):
    path = posixpath.normpath(unquote(urlsplit(raw_path).path))
    return path in PUBLIC_FILES or path.startswith(('/src/', '/assets/'))


def capture_authorized(client_ip, supplied_token):
    if not CAPTURE_TOKEN:
        try:
            return ipaddress.ip_address(client_ip).is_loopback
        except ValueError:
            return False
    return secrets.compare_digest(supplied_token, CAPTURE_TOKEN)


class NoCacheHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if LAN_MODE and not public_game_path(self.path):
            self.send_error(403, 'LAN playtests serve only game assets')
            return
        super().do_GET()

    def do_HEAD(self):
        if LAN_MODE and not public_game_path(self.path):
            self.send_error(403, 'LAN playtests serve only game assets')
            return
        super().do_HEAD()

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
        supplied_token = self.headers.get('X-Zerble-Capture-Token') or parse_qs(parsed.query).get('token', [''])[0]
        if not capture_authorized(self.client_address[0], supplied_token):
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


def capture_url(address, port, scenario=None, seed='3948869160', tier='auto', token=None, quality='auto'):
    if quality not in ('auto', 'baseline') or (quality == 'baseline' and (tier != 'low' or not scenario)):
        raise ValueError('baseline quality requires a guided Low-tier capture')
    params = {'perfCapture': '1'}
    if token:
        params['captureToken'] = token
    if scenario:
        params.update({'perfScenario': scenario, 'seed': seed, 'perfQuality': quality})
        if tier != 'auto':
            params['perf'] = tier
    return f'http://{address}:{port}/?{urlencode(params)}'


def bind_server(host, port, playtest=False):
    # A guided test must not take down an existing dev server on the default port.
    # Bind each candidate directly rather than probing first, which would race.
    candidates = range(port, min(port + 11, 65536)) if playtest else (port,)
    for candidate in candidates:
        server = ThreadingHTTPServer((host, candidate), NoCacheHandler, bind_and_activate=False)
        try:
            server.server_bind()
            server.server_activate()
            return server
        except OSError as error:
            server.server_close()
            if not playtest or error.errno != errno.EADDRINUSE:
                raise
    raise OSError(errno.EADDRINUSE, f'playtest ports {port}-{candidate} are in use; pass --port PORT')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='No-cache Zerble dev server with an ignored JSON capture sink.')
    parser.add_argument('port', nargs='?', type=int, default=8765)
    parser.add_argument('--lan', action='store_true', help='listen on the LAN and require a generated token for remote capture writes')
    parser.add_argument('--playtest', choices=('drive', 'trip', 'parked'), help='print a fixed-seed guided playtest URL')
    parser.add_argument('--seed', default='3948869160', help='world seed for the guided playtest')
    parser.add_argument('--tier', choices=('auto', 'low', 'mid', 'high'), default='auto')
    parser.add_argument('--quality', choices=('auto', 'baseline'), default='auto')
    parser.add_argument('--no-qr', action='store_true', help='print the URL without opening a QR code')
    parser.add_argument('--desktop-open', action='store_true', help='open a loopback playtest in the named browser')
    parser.add_argument('--browser', help='desktop browser app name (default: macOS default browser)')
    args = parser.parse_args()
    if args.quality == 'baseline' and (args.tier != 'low' or not args.playtest):
        parser.error('--quality baseline requires --playtest and --tier low')
    if args.desktop_open and (args.lan or not args.playtest):
        parser.error('--desktop-open requires a loopback --playtest')
    port = args.port
    host = '0.0.0.0' if args.lan else '127.0.0.1'
    if args.lan:
        CAPTURE_TOKEN = secrets.token_urlsafe(18)
        LAN_MODE = True
    server = bind_server(host, port, playtest=bool(args.playtest))
    if server.server_port != port:
        print(f'port {port} is busy; using {server.server_port} for this playtest', flush=True)
    port = server.server_port
    print(f'serving on http://127.0.0.1:{port} (no-cache, +/__capture sink)', flush=True)
    if args.lan:
        addresses = local_ipv4_addresses()
        if addresses:
            addresses.sort(key=lambda address: (not address.startswith('192.168.'), not address.startswith('10.'), address))
            print('phone/iPad playtest URLs:', flush=True)
            for address in addresses:
                print(f'  {capture_url(address, port, args.playtest, args.seed, args.tier, CAPTURE_TOKEN, args.quality)}', flush=True)
            if args.playtest and not args.no_qr:
                qr_path = CAPTURE_DIR / 'playtest-qr.png'
                CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
                qr_script = Path(__file__).resolve().parent.parent / 'bin' / 'perf-qr.m'
                qr_tool = CAPTURE_DIR / 'perf-qr-tool'
                try:
                    subprocess.run(['/usr/bin/clang', '-fobjc-arc', '-framework', 'AppKit', '-framework', 'CoreImage',
                                    str(qr_script), '-o', str(qr_tool)],
                                   check=True, timeout=60, capture_output=True, text=True)
                    subprocess.run([str(qr_tool), capture_url(addresses[0], port, args.playtest, args.seed, args.tier, CAPTURE_TOKEN, args.quality), str(qr_path)],
                                   check=True, timeout=60, capture_output=True, text=True)
                    subprocess.Popen(['/usr/bin/open', str(qr_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    print(f'QR code opened: {qr_path} (scan with the phone camera)', flush=True)
                except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
                    print(f'QR code unavailable ({error}); copy the printed URL instead.', file=sys.stderr, flush=True)
        else:
            print(f'LAN mode is active. Open {capture_url("<this-mac-ip>", port, args.playtest, args.seed, args.tier, CAPTURE_TOKEN, args.quality)}', flush=True)
        print('LAN capture writes require the token embedded in those URLs.', flush=True)
    elif args.playtest:
        url = capture_url('127.0.0.1', port, args.playtest, args.seed, args.tier, quality=args.quality)
        print(f'desktop playtest URL: {url}', flush=True)
        if args.desktop_open:
            open_command = ['/usr/bin/open']
            if args.browser:
                open_command.extend(['-a', args.browser])
            open_command.append(url)
            try:
                subprocess.run(open_command, check=True, timeout=15,
                               capture_output=True, text=True)
                print(f'Opened in {args.browser or "the default browser"}. Click the title-card button (usually "Let\'s go ZERBLIN\'!") to begin.', flush=True)
            except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
                print(f'Could not open {args.browser or "the default browser"} ({error}); open the printed URL manually.', file=sys.stderr, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
