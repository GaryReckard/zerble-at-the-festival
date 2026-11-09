#!/usr/bin/env python3
"""Supervised frozen-pose rendering discriminator; never a frame acceptance input."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tooling'))
from performance_lab.supervisor import supervise, atomic, CleanupFailure
from performance_lab.snapshot import verify
from performance_lab.capability import require, invalidate
from performance_lab.contract import SCHEMA, POLICY

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--quiet', action='store_true', required=True)
parser.add_argument('--tier', choices=['low', 'high'], required=True)
args = parser.parse_args()
bundle = Path(__file__).resolve().parent
manifest = json.loads((bundle / 'render-probe-manifest.json').read_text())
snapshot = Path(manifest['path'])
output = ROOT / '.claude/captures/performance-lab'
require(output, collection=True)
verify(snapshot, manifest)
directory = output / 'diagnostics' / (time.strftime('%Y%m%d-%H%M%S') + '-render-probe-' + args.tier + '-' + uuid.uuid4().hex[:8])
directory.mkdir(parents=True)
worker = bundle / 'render-worker.mjs'
installer = bundle / 'render-install.js'
(directory / 'executed-worker.mjs').write_bytes(worker.read_bytes())
(directory / 'render-install.js').write_bytes(installer.read_bytes())
(directory / 'executed-runner.py').write_bytes(Path(__file__).read_bytes())
atomic(directory / 'diagnostic-input.json', dict(
    app=manifest['app'], build=manifest['build'], harness=manifest['harness'], tier=args.tier,
    quietAssignment='Gary reserved Mac until return, November 7; grant.json',
    workerSha256=hashlib.sha256(worker.read_bytes()).hexdigest(),
    installerSha256=hashlib.sha256(installer.read_bytes()).hexdigest(),
    scope='Frozen-pose rendering work attribution only; not light-v1 or ordinary frame comparison'))
lock = output.with_name('performance-lab.lock')
fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
os.write(fd, str(os.getpid()).encode())
os.close(fd)
clean = True
print(json.dumps(dict(directory=str(directory), tier=args.tier)), flush=True)
try:
    run = dict(schema=SCHEMA, state='prepared', identity=dict(
        runId=directory.name, app=manifest['app'], build=manifest['build'], harness=manifest['harness'],
        scenario='dense-festival-v1', policy=POLICY, instrumentation='structural-render-v1', injectionMs=0, label='diagnostic'),
        conditions=dict(tier=args.tier, seed=2404796662, quiet=True), collector='full')
    owner = supervise(directory, snapshot / 'dist', run=run, deadline=240, smoke=True,
                       worker_command=['node', str(directory / 'executed-worker.mjs')])
    if not owner['cleanup']['ok']:
        clean = False
        invalidate(output, 'Structural render cleanup failed: ' + str(directory))
        raise CleanupFailure(str(directory))
    if owner['state'] != 'collected':
        raise RuntimeError(owner.get('error', 'Structural render capture failed'))
    result = json.loads((directory / 'diagnostic-result.json').read_text())
    if not result.get('ok'):
        raise RuntimeError('Diagnostic result did not pass')
finally:
    if clean:
        lock.unlink()
    verify(snapshot, manifest)
print(json.dumps(dict(directory=str(directory), state='collected', cleanup=owner['cleanup'])), flush=True)
