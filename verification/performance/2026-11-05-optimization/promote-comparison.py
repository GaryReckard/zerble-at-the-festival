#!/usr/bin/env python3
"""Copy terminal comparison evidence, excluding browser profiles and token config.

Existing evidence is immutable: a differing destination byte aborts rather than
overwriting a previous attempt. Run only after the measurement controller exits.
"""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('destination', type=Path)
args = parser.parse_args()
source, destination = args.source.resolve(), args.destination.resolve()
result = json.loads((source / 'result.json').read_text())
if result['state'] not in ('completed', 'failed'):
    raise RuntimeError('Comparison is not terminal')
selected = []
for name in ('inventory.json', 'executed-controller.py', 'result.json'):
    selected.append(source / name)
for folder in sorted(source.iterdir()):
    if not folder.is_dir() or folder.is_symlink():
        continue
    if (folder / 'ownership.json').exists():
        owner = json.loads((folder / 'ownership.json').read_text())
        if not isinstance(owner.get('cleanup'), dict):
            raise RuntimeError('Run still owns resources: ' + str(folder))
        names = ('run.json', 'capture.json', 'ownership.json', 'gesture.json', 'worker-result.json', 'worker.log', 'chrome.log')
    else:
        names = ('calibration.json', 'holdout.json', 'comparison.json')
    selected.extend(folder / name for name in names if (folder / name).is_file())
hashes = {}
for path in selected:
    relative = path.relative_to(source)
    target = destination / relative
    content = path.read_bytes()
    if target.exists() and target.read_bytes() != content:
        raise RuntimeError('Evidence already differs: ' + str(target))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    hashes[str(relative)] = hashlib.sha256(content).hexdigest()
receipt = dict(source=str(source), state=result['state'], files=hashes,
               excluded='Disposable profiles, endpoint/token config and duplicate per-run screenshots; camera qualification retains raw images separately.')
encoded = (json.dumps(receipt, sort_keys=True, indent=2) + '\n').encode()
target = destination / 'promotion.json'
if target.exists() and target.read_bytes() != encoded:
    raise RuntimeError('Promotion inventory differs')
target.write_bytes(encoded)
print(json.dumps(dict(destination=str(destination), files=len(hashes), state=result['state'])))
