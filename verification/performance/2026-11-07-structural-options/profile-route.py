#!/usr/bin/env python3
"""Attribution only: accepted route and process supervisor, instrumented worker."""
import argparse
import hashlib
import json
import os
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tooling'))
from performance_lab.supervisor import supervise, atomic, CleanupFailure
from performance_lab.snapshot import verify
from performance_lab.capability import require, invalidate
from performance_lab.contract import SCHEMA, POLICY

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--quiet', action='store_true', required=True)
parser.add_argument('--tier', choices=['low', 'high'], required=True)
parser.add_argument('--scenario', choices=['streaming-drive-v1', 'dense-festival-v1'], default='streaming-drive-v1')
args = parser.parse_args()
bundle = Path(__file__).resolve().parent
manifest = json.loads((bundle / 'source-manifest.json').read_text())
snapshot = Path(manifest['path'])
output = ROOT / '.claude/captures/performance-lab'
require(output, collection=True)
verify(snapshot, manifest)
directory = output / 'diagnostics' / (time.strftime('%Y%m%d-%H%M%S') + '-route-cpu-' + args.tier + '-' + uuid.uuid4().hex[:8])
directory.mkdir(parents=True)
worker = bundle / 'profile-worker.mjs'
(directory / 'executed-worker.mjs').write_bytes(worker.read_bytes())
(directory / 'executed-runner.py').write_bytes(Path(__file__).read_bytes())
atomic(directory / 'diagnostic-input.json', dict(
    app=manifest['app'], build=manifest['build'], harness=manifest['harness'], tier=args.tier,
    scenario=args.scenario, quietAssignment='Gary reserved Mac until return, November 7; grant.json',
    workerSha256=hashlib.sha256(worker.read_bytes()).hexdigest(),
    scope='Instrumented CPU attribution only; cpu-profile-v1 is incompatible with light-v1 comparison data'))
lock = output.with_name('performance-lab.lock')
fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
os.write(fd, str(os.getpid()).encode())
os.close(fd)
clean = True
print(json.dumps(dict(directory=str(directory), tier=args.tier, scenario=args.scenario)), flush=True)
try:
    run = dict(schema=SCHEMA, state='prepared', identity=dict(
        runId=directory.name, app=manifest['app'], build=manifest['build'], harness=manifest['harness'],
        scenario=args.scenario, policy=POLICY, instrumentation='cpu-profile-v1', injectionMs=0, label='diagnostic'),
        conditions=dict(tier=args.tier, seed=2404796662, quiet=True), collector='full')
    owner = supervise(directory, snapshot / 'dist', run=run, deadline=200,
                       worker_command=['node', str(directory / 'executed-worker.mjs')])
    if not owner['cleanup']['ok']:
        clean = False
        invalidate(output, 'Attribution cleanup failed: ' + str(directory))
        raise CleanupFailure(str(directory))
    if owner['state'] != 'collected':
        raise RuntimeError(owner.get('error', 'Attribution capture failed'))
    profile = json.loads((directory / 'sampled-cpu.json').read_text())
    if not profile.get('samples'):
        raise RuntimeError('No CPU samples were recorded')
finally:
    if clean:
        lock.unlink()
    verify(snapshot, manifest)
print(json.dumps(dict(directory=str(directory), state='collected', cleanup=owner['cleanup'])), flush=True)
