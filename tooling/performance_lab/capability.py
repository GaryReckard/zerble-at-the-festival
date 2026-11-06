"""Fail closed until the exact backend has passed its real safety probes."""
import hashlib,json
from pathlib import Path
from .contract import digest,errors
from .supervisor import CHROME,atomic

def signature():
    root=Path(__file__).parent
    return digest(dict(files={n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ['worker.mjs','supervisor.py']},chrome=dict(size=Path(CHROME).stat().st_size,mtime=Path(CHROME).stat().st_mtime_ns)))

def fault_entered(directory,kind):
    try:
        d=Path(directory);proof=json.loads((d/'fault-entered.json').read_text())
        return proof.get('entered') is True and proof.get('kind')==kind and isinstance(proof.get('targetId'),str) and bool(proof['targetId']) and proof.get('runId')==d.name
    except (OSError,ValueError,AttributeError):return False

def invalidate(output,reason):
    path=Path(output)/'capabilities.json'
    atomic(path,dict(signature=signature(),proofs={},blocked=str(reason)))

def record(output,directory,kind):
    if kind in ('worker-death','page-hang') and not fault_entered(directory,kind):raise ValueError('Requested fault never entered: '+kind)
    output=Path(output);path=output/'capabilities.json';sig=signature()
    value=json.loads(path.read_text()) if path.exists() else {}
    if value.get('signature')!=sig:value=dict(signature=sig,proofs={})
    value.pop('blocked',None)
    value['proofs'][kind]=str(Path(directory).resolve());atomic(path,value)

def require(output,collection=False):
    p=Path(output)/'capabilities.json'
    if not p.exists():raise ValueError('Hardware backend unaccepted; run the normal, worker-death and page-hang probes first')
    value=json.loads(p.read_text())
    if value.get('blocked'):raise ValueError('Backend capability revoked: '+value['blocked'])
    if value.get('signature')!=signature():raise ValueError('Backend changed; its safety probes must be repeated')
    for kind in ['normal','worker-death','page-hang']+(['collection'] if collection else []):
        location=value.get('proofs',{}).get(kind)
        if not location:raise ValueError('Missing accepted backend proof: '+kind)
        d=Path(location);owner=json.loads((d/'ownership.json').read_text())
        if not owner.get('cleanup',{}).get('ok'):raise ValueError('Unverified cleanup: '+kind)
        if kind=='normal':
            gpu=json.loads((d/'probe.json').read_text())
            if owner['state']!='collected' or gpu.get('gpuVerified') is not True or not isinstance(gpu.get('gpu'),str) or not gpu['gpu'] or not gpu.get('visible') or not gpu.get('focused') or not gpu.get('titleGesture') or any(x in gpu.get('gpu','').lower() for x in ['software','swiftshader','llvmpipe']):raise ValueError('Invalid normal GPU probe')
        elif kind=='collection':
            from .contract import load_run
            r=load_run(d/'run.json')
            if errors(r) or r['identity']['scenario']!='dense-festival-v1':raise ValueError('Invalid parked collection proof')
        else:
            expected='Control worker exited -9' if kind=='worker-death' else 'Overall run deadline'
            if owner['state']=='collected' or owner.get('error')!=expected or not fault_entered(d,kind):raise ValueError('Unexpected fault result: '+kind)
    return value
