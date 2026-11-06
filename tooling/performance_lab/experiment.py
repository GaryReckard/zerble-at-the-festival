"""Serial experiment controller. Never build, analyze heavily, or launch in parallel."""
import json,time,uuid
from pathlib import Path
from .contract import SCHEMA,POLICY,summarize,load_run,errors
from .analysis import ORDER,calibrate,compare,readable
from .snapshot import verify
from .supervisor import supervise,atomic,CleanupFailure

def experiment(snapshot,output,injection=40):
    snapshot=Path(snapshot).resolve();output=Path(output).resolve();manifest=json.loads((snapshot/'manifest.json').read_text());verify(snapshot,manifest)
    directory=output/'experiments'/(time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);directory.mkdir(parents=True)
    inventory=dict(scenarios=['dense-festival-v1','streaming-drive-v1'],calibrationPerScenario=4,holdoutPerScenario=8,injectionPerScenario=8,overheadPerScenario=4,totalRuns=48,acceptedMeasurementMinutes=36,injectionMs=injection,quiet=True,hardwareScope='reserved Mac, not proven OS isolation')
    atomic(directory/'inventory.json',inventory);print(json.dumps(inventory),flush=True)
    count=0
    def collect(scenario,label,dose=0,collector='full'):
        nonlocal count
        count+=1;runId=f'{directory.name}-{count:02d}';runDir=directory/runId
        run=dict(schema=SCHEMA,state='prepared',identity=dict(runId=runId,app=manifest['app'],build=manifest['build'],harness=manifest['harness'],scenario=scenario,policy=POLICY,instrumentation='light-v1' if collector=='full' else 'sentinel-v1',injectionMs=dose,label=label),conditions=dict(tier='high',seed=2404796662,quiet=True),collector=collector)
        print(f'Run {count}/48: {scenario} {label} injection={dose} collector={collector}',flush=True)
        verify(snapshot,manifest)
        result=supervise(runDir,snapshot/'dist',run=run,deadline=90 if scenario=='dense-festival-v1' else 180)
        verify(snapshot,manifest)
        if not result['cleanup']['ok']:raise CleanupFailure(f'Unverified cleanup: {runDir}')
        if result['state']!='collected' or not (runDir/'run.json').exists():raise RuntimeError(f'Execution failed: {runDir}')
        capture=load_run(runDir/'run.json')
        if errors(capture):raise RuntimeError('Invalid run contract: '+str(runDir))
        return capture
    results={}
    try:
        for scenario in inventory['scenarios']:
            folder=directory/scenario;folder.mkdir()
            overhead=[collect(scenario,'overhead',collector=mode) for mode in ['sentinel','full','full','sentinel']]
            stats=[summarize(r) for r in overhead]
            delta=(stats[1]['wallP95']+stats[2]['wallP95']-stats[0]['wallP95']-stats[3]['wallP95'])/2
            threshold=max(2,(stats[0]['wallP95']+stats[3]['wallP95'])/2*.1)
            check=dict(incrementalP95=delta,threshold=threshold,accepted=delta<=threshold,runIds=[r['identity']['runId'] for r in overhead],limit='four-run sentinel comparison; not zero observer cost')
            atomic(folder/'overhead.json',check)
            if not check['accepted']:raise RuntimeError('Collector overhead failed: '+scenario)
            calibration=calibrate([collect(scenario,'calibration') for _ in range(4)]);atomic(folder/'calibration.json',calibration)
            if calibration.get('state')!='frozen':raise RuntimeError('Calibration unstable: '+scenario)
            holdout=compare([collect(scenario,label) for label in ORDER],calibration,validation=True);atomic(folder/'holdout.json',holdout)
            if holdout['verdict']!='no detectable change':raise RuntimeError('Fresh holdout failed: '+scenario)
            candidate=compare([collect(scenario,label,injection if label=='B' else 0) for label in ORDER],calibration,holdout);atomic(folder/'sensitivity.json',candidate)
            added=[candidate.get('injectedWorkMs',[0]*8)[i] for i in [1,2,5,6]]
            if candidate['verdict']!='regressed' or any(x<injection*.9 for x in added):raise RuntimeError('Comparable injection not detected: '+scenario)
            results[scenario]=candidate;print(readable(candidate),flush=True)
        atomic(directory/'result.json',dict(state='accepted',scope='two-scenario sensitivity validation; injected variant is deliberately slower',results=results))
    except Exception as error:
        atomic(directory/'result.json',dict(state='failed',error=str(error),completedScenarios=list(results)));raise
    return directory
