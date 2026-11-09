#!/usr/bin/env python3
"""Fresh frozen-baseline comparisons through the accepted lab collector/policy."""
import argparse,hashlib,json,os,sys,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'tooling'))
from performance_lab.supervisor import supervise,atomic,CleanupFailure
from performance_lab.snapshot import verify
from performance_lab.capability import require,invalidate
from performance_lab.contract import SCHEMA,POLICY,load_run,errors
from performance_lab.analysis import ORDER,calibrate,compare,readable,suite_verdict

p=argparse.ArgumentParser(description=__doc__);p.add_argument('--quiet',action='store_true',required=True)
p.add_argument('--baseline',type=Path,required=True);p.add_argument('--candidate',type=Path,required=True)
p.add_argument('--tiers',nargs='+',choices=['low','high'],default=['high','low'])
p.add_argument('--conditions',nargs='+',choices=[t+':'+s for t in ['low','high'] for s in ['dense-festival-v1','streaming-drive-v1']])
p.add_argument('--calibration-runs',type=int,choices=[4,8],default=4)
p.add_argument('--prior-attempt',type=Path)
a=p.parse_args();output=ROOT/'.claude/captures/performance-lab';require(output,collection=True)
conditions=[tuple(c.split(':')) for c in a.conditions] if a.conditions else [(t,s) for t in a.tiers for s in ['dense-festival-v1','streaming-drive-v1']]
if len(conditions)!=len(set(conditions)):raise RuntimeError('Repeated comparison condition')
prior=None
if a.prior_attempt:
  prior=dict(path=str(a.prior_attempt.resolve()),result=json.loads((a.prior_attempt/'result.json').read_text()))
  if prior['result']['state']!='failed':raise RuntimeError('Prior attempt is not a preserved terminal failure')
snapshots={'A':a.baseline.resolve(),'B':a.candidate.resolve()};manifests={k:json.loads((v/'manifest.json').read_text()) for k,v in snapshots.items()}
for k in snapshots:verify(snapshots[k],manifests[k])
if manifests['A']['harness']!=manifests['B']['harness']:raise RuntimeError('Baseline/candidate collector identity differs')
directory=output/'comparisons'/(time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);directory.mkdir(parents=True)
inventory=dict(tiers=list(dict.fromkeys(t for t,s in conditions)),scenarios=list(dict.fromkeys(s for t,s in conditions)),conditions=conditions,
  recipe='expanded-baseline-calibration-v2' if a.calibration_runs==8 else 'four-baseline-calibration-v1',
  calibration=a.calibration_runs,freshHoldout=8,pairedCandidate=8,priorAttempt=prior,
  totalRuns=len(conditions)*(a.calibration_runs+16),source={k:dict(path=str(snapshots[k]),app=v['app'],build=v['build'],harness=v['harness']) for k,v in manifests.items()},
  quietAssignment='Gary reserved Mac on November 6 until he announces his return; window-3/grant.json',policy=POLICY,controllerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
  limitations='Prepared fixed-tier desktop runs; not iPad, Auto, temperature control, or subjective driving acceptance')
atomic(directory/'inventory.json',inventory);(directory/'executed-controller.py').write_bytes(Path(__file__).read_bytes())
lock=output.with_name('performance-lab.lock');fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.write(fd,str(os.getpid()).encode());os.close(fd)
count=0;results={};clean=True
print(json.dumps(dict(directory=str(directory),**inventory)),flush=True)
def collect(tier,scenario,stage,label,variant):
  global count,clean
  count+=1;manifest=manifests[variant];snapshot=snapshots[variant];runId=f'{directory.name}-{count:02d}'
  target=directory/runId
  run=dict(schema=SCHEMA,state='prepared',identity=dict(runId=runId,app=manifest['app'],build=manifest['build'],harness=manifest['harness'],scenario=scenario,
    policy=POLICY,instrumentation='light-v1',injectionMs=0,label=label),conditions=dict(tier=tier,seed=2404796662,quiet=True),collector='full')
  print(f'Run {count}/{inventory["totalRuns"]}: {tier} {scenario} {stage} label={label} source={variant}',flush=True)
  verify(snapshot,manifest)
  owner=supervise(target,snapshot/'dist',run=run,deadline=100 if scenario=='dense-festival-v1' else 200)
  verify(snapshot,manifest)
  if not owner['cleanup']['ok']:
    clean=False;invalidate(output,'Comparison cleanup failed: '+str(target));raise CleanupFailure(str(target))
  if owner['state']!='collected':raise RuntimeError('Failed capture: '+str(target)+' '+str(owner.get('error')))
  data=load_run(target/'run.json')
  if errors(data):raise RuntimeError('Invalid captured work: '+str(target))
  return data
try:
  for tier,scenario in conditions:
      folder=directory/(tier+'-'+scenario);folder.mkdir()
      calibration=calibrate([collect(tier,scenario,'calibration','A','A') for _ in range(a.calibration_runs)]);atomic(folder/'calibration.json',calibration)
      if calibration.get('state')!='frozen':raise RuntimeError('Unstable calibration: '+str(folder))
      print('Frozen thresholds: '+json.dumps(calibration['thresholds']),flush=True)
      holdout=compare([collect(tier,scenario,'holdout',label,'A') for label in ORDER],calibration,validation=True);atomic(folder/'holdout.json',holdout)
      if holdout['verdict']!='no detectable change':raise RuntimeError('Independent holdout failed: '+str(folder))
      result=compare([collect(tier,scenario,'candidate',label,label) for label in ORDER],calibration,holdout);atomic(folder/'comparison.json',result)
      results[tier+'-'+scenario]=result;print(readable(result),flush=True)
      if result['verdict'] in ('regressed','comparison invalid'):raise RuntimeError('Candidate did not pass: '+str(folder))
  atomic(directory/'result.json',dict(state='completed',verdict=suite_verdict(results),results=results))
except BaseException as error:
  atomic(directory/'result.json',dict(state='failed',error=str(error),completedRuns=count,results=results));raise
finally:
  if clean:lock.unlink()
  for k in snapshots:verify(snapshots[k],manifests[k])
