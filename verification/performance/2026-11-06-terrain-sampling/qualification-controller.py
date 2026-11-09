import json,subprocess
from pathlib import Path
b=Path('verification/performance/2026-11-06-terrain-sampling');m=json.loads((b/'candidate-manifest.json').read_text());rows=[]
for operation in ['smoke','run']:
 for tier in ['low','mid','high']:
  log=Path('/private/tmp/zerble-terrain-'+operation+'-'+tier+'.log')
  cmd=['bin/perf-lab',operation,'--quiet','--snapshot',m['path'],'--tier',tier,'--deadline','200']
  if operation=='run':cmd+=['--scenario','streaming-drive-v1']
  print(operation,tier,flush=True)
  with log.open('w')as out:r=subprocess.run(cmd,stdout=out,stderr=subprocess.STDOUT,timeout=240)
  lines=log.read_text().splitlines();meta=json.loads(lines[0]);row=dict(operation=operation,tier=tier,exitCode=r.returncode,directory=meta['directory'],log=str(log));rows.append(row);(b/'qualification-results.json').write_text(json.dumps(rows,indent=2)+'\n')
  if r.returncode:raise RuntimeError(str(row))
print('Qualification complete',flush=True)
