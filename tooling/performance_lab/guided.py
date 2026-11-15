"""Collect the existing guided device route using the accepted process supervisor."""
import argparse, functools, http.server, json, os, re, secrets, threading, time, uuid
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, urlencode
from . import capability, snapshot
from .supervisor import supervise, atomic, CleanupFailure

class GuidedHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def setup(self):
        super().setup()
        self.connection.settimeout(5)
    def do_POST(self):
        cfg = self.server.guided
        url = urlsplit(self.path)
        if not re.fullmatch(r'/__capture/[A-Za-z0-9_-]{1,64}', url.path):
            self.send_error(404); return
        if self.headers.get('Origin') != cfg['origin'] or parse_qs(url.query).get('token') != [cfg['token']]:
            self.send_error(403); return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 32 * 1024 * 1024:
                self.send_error(413); return
            report = json.loads(self.rfile.read(size))
            if not isinstance(report, dict) or report.get('schema') != 'zerble-device-perf-v2':
                self.send_error(422); return
            with cfg['lock']:
                target = cfg['directory'] / ('device-report.json' if report.get('reason') == 'complete' else 'device-partial.json')
                atomic(target, report)
            body = b'{"saved":true}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers(); self.wfile.write(body)
        except (ValueError, OSError):
            self.send_error(400)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--quiet', action='store_true', required=True)
    p.add_argument('--snapshot', type=Path, required=True)
    p.add_argument('--output', type=Path, default=snapshot.ROOT/'.claude/captures/performance-lab')
    p.add_argument('--mode', choices=['basic', 'detail'], required=True)
    p.add_argument('--deadline', type=int, default=200)
    a = p.parse_args()
    if not 90 <= a.deadline <= 240: p.error('deadline must be 90..240 seconds')
    capability.require(a.output)
    manifest = json.loads((a.snapshot/'manifest.json').read_text())
    snapshot.verify(a.snapshot, manifest)
    run_id = time.strftime('%Y%m%d-%H%M%S')+'-guided-'+a.mode+'-'+uuid.uuid4().hex[:8]
    directory = (a.output/'guided'/run_id).resolve()
    lock = snapshot.ROOT/'.claude/captures/performance-lab.lock'
    lock.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(lock, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
    os.write(fd, str(os.getpid()).encode()); os.close(fd)
    server = None; cleanup_ok = True
    try:
        directory.mkdir(parents=True)
        server = http.server.ThreadingHTTPServer(('127.0.0.1',0), functools.partial(GuidedHandler,directory=str((a.snapshot/'dist').resolve())))
        origin = f'http://127.0.0.1:{server.server_port}'
        token = secrets.token_hex(24)
        server.guided = dict(origin=origin,token=token,directory=directory,lock=threading.Lock())
        threading.Thread(target=server.serve_forever,daemon=True).start()
        params = dict(mute=1,perf='low',physics=1,seed=2404796662,x=-230.3,z=-691.8,heading=2.3580,tod=0.3,perfCapture=1,perfScenario='drive',perfAutopilot='road-follow-v1',perfQuality='baseline',perfKids='full-v1',captureToken=token)
        if a.mode == 'detail': params['perfWorld'] = 1
        atomic(directory/'guided-config.json',dict(url=origin+'/?'+urlencode(params),deadline=a.deadline))
        atomic(directory/'metadata.json',dict(mode=a.mode,kind='guided-device-route',quiet=True,seed=2404796662,tier='low',quality='baseline',snapshot=str(a.snapshot.resolve()),app=manifest['app'],build=manifest['build'],harness=manifest['harness']))
        print(json.dumps(dict(directory=str(directory),mode=a.mode)),flush=True)
        run = dict(identity=dict(runId=run_id,scenario='guided-device-route'),conditions=dict(tier='low',seed=2404796662))
        # Once browser ownership may begin, only a returned cleanup receipt can
        # release the lease. A failed supervisor final write is not that proof.
        cleanup_ok = False
        try:
            result = supervise(directory,a.snapshot/'dist',run=run,smoke=True,deadline=a.deadline,worker_command=['node',str(Path(__file__).with_name('guided-worker.mjs').resolve())])
        except BaseException as error:
            capability.invalidate(a.output,'Guided supervisor exited without cleanup receipt: '+str(directory)+'; '+str(error))
            raise
        cleanup_ok = result.get('cleanup',{}).get('ok',False)
        if not cleanup_ok:
            capability.invalidate(a.output,'Guided process cleanup failed: '+str(directory))
            raise CleanupFailure(str(directory))
        atomic(directory/'guided-result.json',result)
        print(json.dumps(dict(directory=str(directory),state=result['state'],error=result.get('error'),cleanup=result['cleanup'])),flush=True)
        return 0 if result['state']=='collected' else 2
    finally:
        if server: server.shutdown(); server.server_close()
        if cleanup_ok: lock.unlink()
        snapshot.verify(a.snapshot,manifest)

if __name__ == '__main__':
    raise SystemExit(main())
