#!/usr/bin/env python3
"""Create a disposable diagnostic build, without changing application sources."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tooling'))
from performance_lab.contract import digest
from performance_lab.snapshot import verify
from performance_lab.supervisor import atomic

bundle = Path(__file__).resolve().parent
baseline = json.loads((bundle / 'source-manifest.json').read_text())
original = Path(baseline['path'])
verify(original, baseline)
target = ROOT / '.claude/captures/performance-lab/structural-prototype-src' / ('render-' + uuid.uuid4().hex[:12])
target.mkdir(parents=True)
for name in baseline['files']:
    destination = target / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(original / name, destination)
bootstrap = """
// Disposable, local diagnostic build only. Not part of the working application.
if (['localhost', '127.0.0.1'].includes(location.hostname) &&
    new URLSearchParams(location.search).has('structuralProbe')) {
  import('./people/childPresentation.js').then(module => {
    window.__structuralPresentation = module.createChildPresentation;
  });
}
"""
main = target / 'src/main.js'
with main.open('a') as stream:
    stream.write(bootstrap)
os.symlink(ROOT / 'node_modules', target / 'node_modules', target_is_directory=True)
with (target / 'build.log').open('w') as log:
    result = subprocess.run(['npm', 'run', 'build'], cwd=target, stdout=log, stderr=subprocess.STDOUT, timeout=120)
if result.returncode:
    raise RuntimeError('Diagnostic build failed: ' + str(target / 'build.log'))
hashes = {name: hashlib.sha256((target / name).read_bytes()).hexdigest() for name in baseline['files']}
manifest = dict(baseline, files=hashes, app=digest(hashes), build=digest({
    str(p.relative_to(target / 'dist')): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted((target / 'dist').rglob('*')) if p.is_file()}), path=str(target))
atomic(target / 'manifest.json', manifest)
verify(target, manifest)
atomic(bundle / 'render-probe-manifest.json', manifest)
atomic(bundle / 'render-build-provenance.json', dict(
    baselineApp=baseline['app'], diagnosticApp=manifest['app'], diagnosticBuild=manifest['build'],
    changedSourceFiles=[name for name in hashes if hashes[name] != baseline['files'][name]],
    bootstrap=bootstrap, scope='Diagnostic-only module exposure; no application working-tree edits'))
print(json.dumps(dict(path=str(target), app=manifest['app'], build=manifest['build'])))
