#!/usr/bin/env python3
"""Reserved-Mac functional route pilot, not an accepted timing comparison."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import uuid
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tooling'))
from performance_lab import supervisor
from performance_lab.snapshot import verify
from performance_lab.capability import require,invalidate
from performance_lab.contract import SCHEMA,POLICY

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--quiet',action='store_true',required=True)
parser.add_argument('--snapshot',type=Path,required=True)
parser.add_argument('--stop-smoke',action='store_true')
parser.add_argument('--child-cohort',choices=['full-v1','half-v1'],default='half-v1')
args=parser.parse_args()
snapshot=args.snapshot.resolve();manifest=json.loads((snapshot/'manifest.json').read_text())
output=ROOT/'.claude/captures/performance-lab';require(output,collection=True);verify(snapshot,manifest)
directory=output/'diagnostics'/(time.strftime('%Y%m%d-%H%M%S')+'-device-autopilot-'+uuid.uuid4().hex[:8]);directory.mkdir(parents=True)
worker=Path(__file__).with_name('pilot-worker.mjs')
(directory/'executed-worker.mjs').write_bytes(worker.read_bytes())
(directory/'executed-runner.py').write_bytes(Path(__file__).read_bytes())
supervisor.atomic(directory/'input.json',dict(app=manifest['app'],build=manifest['build'],harness=manifest['harness'],quietGrant='Gary: im heading out for sleep. feel free to make progress on what you can while im ouu',childCohort=args.child_cohort,stopSmoke=args.stop_smoke,scope='Functional route/export pilot only; new diagnostic HTTP adapter; no calibrated frame claims',workerSha256=hashlib.sha256(worker.read_bytes()).hexdigest()))

# Keep the proven process supervisor unchanged. This task-local HTTP adapter
# durably receives the guided device schema rather than the lab schema.
Original=supervisor.Handler
class GuidedHandler(Original):
    def do_POST(self):
        if not self.path.startswith('/__capture/'):
            return super().do_POST()
        if self.headers.get('Origin')!=self.server.lab['origin']:
            self.send_error(403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=32*1024*1024:raise ValueError('size')
            value=json.loads(self.rfile.read(size))
            if value.get('schema')!='zerble-device-perf-v2':raise ValueError('schema')
            supervisor.atomic(directory/'guided-report.json',value)
            self.send_response(200);self.send_header('Content-Length','2');self.end_headers();self.wfile.write(b'OK')
        except (ValueError,OSError):self.send_error(400)
supervisor.Handler=GuidedHandler
lock=output.with_name('performance-lab.lock');fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.write(fd,str(os.getpid()).encode());os.close(fd)
clean=True
print(json.dumps(dict(directory=str(directory))),flush=True)
try:
    run=dict(schema=SCHEMA,state='prepared',identity=dict(runId=directory.name,app=manifest['app'],build=manifest['build'],harness=manifest['harness'],scenario='streaming-drive-v1',policy=POLICY,instrumentation='device-world-route-v1',injectionMs=0,label='functional-pilot'),conditions=dict(tier='low',seed=2404796662,quiet=True))
    owner=supervisor.supervise(directory,snapshot/'dist',run=run,smoke=True,deadline=185,worker_command=['node',str(directory/'executed-worker.mjs')])
    if not owner['cleanup']['ok']:
        clean=False;invalidate(output,'Device autopilot cleanup failed');raise RuntimeError('Cleanup failed')
    if owner['state']!='collected':raise RuntimeError(owner.get('error','Pilot failed'))
finally:
    if clean:lock.unlink()
    verify(snapshot,manifest)
print(json.dumps(dict(directory=str(directory),state=owner['state'],cleanup=owner['cleanup'])),flush=True)
