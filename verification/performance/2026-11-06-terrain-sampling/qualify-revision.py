#!/usr/bin/env python3
"""Sequential revised-source qualification; --quiet requires a reserved Mac."""
import argparse
import json
import subprocess
import uuid
from datetime import datetime,timezone
from pathlib import Path

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--quiet',action='store_true',required=True)
p.parse_args()
ROOT=Path(__file__).resolve().parents[3]
bundle=Path(__file__).resolve().parent
manifest=json.loads((bundle/'revised-candidate-manifest.json').read_text())
attempt=bundle/'qualification-revision'/(datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8])
attempt.mkdir(parents=True)
(attempt/'executed-controller.py').write_bytes(Path(__file__).read_bytes())
(attempt/'input.json').write_text(json.dumps(manifest,indent=2)+'\n')
rows=[]
operations=[('smoke',tier,None)for tier in ('low','mid','high')]
operations += [('run',tier,'streaming-drive-v1')for tier in ('low','mid','high')]
operations += [('run','high','dense-festival-v1')]
for operation,tier,scenario in operations:
    label=operation+'-'+tier+('-parked'if scenario=='dense-festival-v1'else'')
    log=attempt/(label+'.log')
    command=[str(ROOT/'bin/perf-lab'),operation,'--quiet','--snapshot',manifest['path'],'--tier',tier,'--deadline','200']
    if scenario:command += ['--scenario',scenario]
    print(label,flush=True)
    with log.open('w')as output:
        # The accepted supervisor owns the 200-second browser deadline and its
        # cleanup. Do not externally kill that owner before teardown completes.
        result=subprocess.run(command,cwd=ROOT,stdout=output,stderr=subprocess.STDOUT)
    lines=log.read_text().splitlines()
    metadata=next((json.loads(line)for line in lines if line.startswith('{"runId"')),None)
    directory=Path(metadata['directory'])if metadata else None
    owner=json.loads((directory/'ownership.json').read_text())if directory and(directory/'ownership.json').exists()else None
    cleanup=bool(owner and owner.get('state')=='collected'and owner.get('cleanup',{}).get('ok')is True)
    row=dict(operation=operation,tier=tier,scenario=scenario,exitCode=result.returncode,log=str(log),directory=str(directory)if directory else None,cleanup=cleanup,attempt=str(attempt))
    rows.append(row)
    (bundle/'revision-qualification-results.json').write_text(json.dumps(rows,indent=2)+'\n')
    (attempt/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
    if result.returncode or not cleanup:raise RuntimeError(str(row))
print('Revised qualification complete',flush=True)
