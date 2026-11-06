"""Small explicit source inventory, not a Git checkout or arbitrary file archive."""
import hashlib,json,os,shutil,subprocess
from pathlib import Path
from .contract import digest
from .supervisor import atomic

ROOT=Path(__file__).resolve().parents[2]

def snapshot(destination):
    files=subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
    allowed=[]
    for name in sorted(set(files)):
        p=ROOT/name
        if not name or not p.is_file() or p.is_symlink():continue
        if name in ('bin/perf-lab','bin/compare-perf-runs','bin/report-perf-playtest') or name.startswith(('src/','assets/','tooling/')) or ('/' not in name and ((name.endswith(('.html','.css','.mjs','.png','.ico','.svg','.webmanifest')) or name in ('package.json','package-lock.json')))):
            if any(part.startswith('.') for part in Path(name).parts):continue
            allowed.append(name)
    hashes={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in allowed}
    app=digest(hashes);target=Path(destination).resolve()/app
    if (target/'manifest.json').exists():
        manifest=json.loads((target/'manifest.json').read_text());verify(target,manifest);return target,manifest
    target.mkdir(parents=True,exist_ok=True)
    for name in allowed:
        p=target/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,p)
    if not (target/'node_modules').exists():os.symlink(ROOT/'node_modules',target/'node_modules',target_is_directory=True)
    result=subprocess.run(['npm','run','build'],cwd=target,stdout=open(target/'build.log','w'),stderr=subprocess.STDOUT,timeout=120)
    if result.returncode:raise RuntimeError(f'Snapshot build failed; see {target}/build.log')
    manifest=dict(app=app,build=digest({str(p.relative_to(target/'dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((target/'dist').rglob('*')) if p.is_file()}),files=hashes,head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),dirty=subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True),dependencies=hashes['package-lock.json'],harness=digest({n:h for n,h in hashes.items() if n.startswith(('tooling/performance_lab/','src/performanceLab/')) or n in ('bin/perf-lab','bin/compare-perf-runs','bin/report-perf-playtest')}))
    (target/'dirty.patch').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=ROOT))
    atomic(target/'manifest.json',manifest);return target,manifest

def verify_host(manifest,host_root=None):
    host_root=ROOT if host_root is None else Path(host_root)
    names=[n for n in manifest['files'] if n.startswith('tooling/performance_lab/') or n in ('bin/perf-lab','bin/compare-perf-runs','bin/report-perf-playtest')]
    if not names:raise RuntimeError('Snapshot missing host harness inventory')
    for name in names:
        path=host_root/name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=manifest['files'][name]:
            raise RuntimeError('Live host harness drift: '+name+'; prepare a current snapshot before launching')

def verify(target,manifest,host_root=None):
    for name,expected in manifest['files'].items():
        p=target/name
        if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise RuntimeError('Snapshot source drift: '+name)
    actual=digest({str(p.relative_to(target/'dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((target/'dist').rglob('*')) if p.is_file()})
    if actual!=manifest['build']:raise RuntimeError('Snapshot build drift')
    # Python modules and the Node worker execute from the live checkout. Bind
    # those bytes to the declared snapshot before AND after every launch.
    verify_host(manifest,host_root)
