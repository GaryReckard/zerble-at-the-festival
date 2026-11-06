#!/usr/bin/env python3
"""One bounded attribution run under the existing lab process owner, not a comparison verdict."""
import argparse,hashlib,json,os,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tooling'))
from performance_lab.supervisor import supervise,CleanupFailure,atomic
from performance_lab.snapshot import verify
from performance_lab.capability import require,invalidate

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--quiet',action='store_true',required=True)
p.add_argument('--snapshot',type=Path,required=True)
p.add_argument('--tier',choices=['low','mid','high'],default='low')
p.add_argument('--task',choices=['subtract','cpu','cameras'],default='subtract')
p.add_argument('--kid-batch',action='store_true')
a=p.parse_args();output=ROOT/'.claude/captures/performance-lab';require(output)
manifest=json.loads((a.snapshot/'manifest.json').read_text());verify(a.snapshot,manifest)
directory=output/'diagnostics'/(time.strftime('%Y%m%d-%H%M%S')+'-'+a.task+'-'+a.tier+'-'+uuid.uuid4().hex[:8]);directory.mkdir(parents=True)
worker=Path(__file__).with_name('diagnostic-worker.mjs')
worker_source=worker.read_bytes();(directory/'executed-worker.mjs').write_bytes(worker_source)
(directory/'executed-runner.py').write_bytes(Path(__file__).read_bytes())
atomic(directory/'diagnostic-input.json',dict(task=a.task,tier=a.tier,kidBatch=a.kid_batch,app=manifest['app'],build=manifest['build'],
    workerSha256=hashlib.sha256(worker_source).hexdigest(),runnerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    quietAssignment='Gary: mac is all your, November 5',scope='Attribution/integration; not calibrated equal-work comparison'))
lock=output.with_name('performance-lab.lock');fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.write(fd,str(os.getpid()).encode());os.close(fd)
clean=True
print(json.dumps(dict(directory=str(directory),task=a.task,tier=a.tier)),flush=True)
try:
    run=dict(identity=dict(runId=directory.name,scenario='dense-festival-v1'),conditions=dict(tier=a.tier,seed=2404796662))
    owner=supervise(directory,a.snapshot/'dist',run=run,smoke=True,deadline=180,worker_command=['node',str(directory/'executed-worker.mjs')])
    if not owner['cleanup']['ok']:
        clean=False;invalidate(output,'Diagnostic cleanup failed: '+str(directory));raise CleanupFailure(str(directory))
    if owner['state']!='collected':raise RuntimeError(owner.get('error','Diagnostic failed'))
finally:
    if clean:lock.unlink()
    verify(a.snapshot,manifest)
print(json.dumps(dict(directory=str(directory),state=owner['state'],cleanup=owner['cleanup'])),flush=True)
