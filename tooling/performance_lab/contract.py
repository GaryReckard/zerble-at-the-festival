"""Versioned, dependency-free lab capture validation and exact-frame statistics."""
import hashlib
import json
import math
import statistics

SCHEMA = 'zerble-performance-lab-v1'
POLICY = 'conservative-paired-v1'
MAX_FRAMES = 32768
MAX_BYTES = 24 * 1024 * 1024
STATES = ('prepared', 'ready', 'settling', 'measuring', 'exporting', 'completed', 'failed', 'interrupted')
VERDICTS = ('improved', 'regressed', 'no detectable change', 'comparison invalid')

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()

def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()

def finite(n):
    return isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n)

def quantile(values, q):
    return sorted(values)[max(0, math.ceil(len(values)*q)-1)] if values else None

def frame_summary(frames):
    walls=[f[0] for f in frames];work=[f[1] for f in frames];seconds=sum(walls)/1000
    return dict(frames=len(frames),wallMedian=quantile(walls,.5),wallP95=quantile(walls,.95),
                wallP99=quantile(walls,.99),worstWall=max(walls,default=None),workMedian=quantile(work,.5),
                workP95=quantile(work,.95),over50=sum(x>50 for x in walls),over100=sum(x>100 for x in walls),
                stallRate=sum(x>50 for x in walls)/seconds if seconds else None,
                severeRate=sum(x>100 for x in walls)/seconds if seconds else None,wallSeconds=seconds)

def summarize(run):
    frames=run.get('frames',[]);progress=run.get('progress',{})
    result=frame_summary(frames)
    result.update(completionSeconds=progress.get('routeWallSeconds',progress.get('wallSeconds')),
                  timeLost=progress.get('outerLost',0)+progress.get('physicsDropped',0),
                  segments={str(segment):frame_summary([f for f in frames if f[2]==segment]) for segment in sorted({f[2] for f in frames})})
    return result

def errors(run, completed=True):
    e=[]
    if not isinstance(run,dict): return ['object-required']
    if run.get('schema') != SCHEMA: e.append('schema')
    if run.get('state') not in STATES: e.append('lifecycle')
    if not completed:
        if not isinstance(run.get('identity'),dict) or not run['identity'].get('runId'):e.append('run-id')
        frames=run.get('frames',[])
        if not isinstance(frames,list) or len(frames)>MAX_FRAMES:e.append('frames')
        elif any(not isinstance(f,list) or len(f)!=5 or not all(finite(x) and x>=0 for x in f) for f in frames):e.append('frame-format')
        return e
    for section,keys in {'identity':['runId','app','build','harness','scenario','policy','instrumentation'],
                         'conditions':['gpu','browser','tier','width','height','dpr','quiet','seed'],
                         'progress':['acceptedSeconds','wallSeconds','outerLost','physicsDropped','physicsSteps','complete'],
                         'semantic':['contentPolicy','routePolicy','populationMin','populationMax','childrenMin','childrenMax'],
                         'cost':['drawsMin','drawsMax']}.items():
        obj=run.get(section)
        if not isinstance(obj,dict): e.append(section); continue
        for key in keys:
            if key not in obj or obj[key] is None: e.append(f'{section}.{key}')
    if any(not isinstance(run.get(k),dict) for k in ('identity','conditions','progress','semantic','cost')):return e
    for key in ('runId','app','build','harness','scenario','policy','instrumentation'):
        if not isinstance(run['identity'].get(key),str) or not run['identity'][key]:e.append('identity.'+key+':string-required')
    if any(not isinstance(run['identity'].get(key),str) or not run['identity'][key] for key in ('runId','app','build','harness','scenario','policy','instrumentation')):return e
    if run['identity']['policy']!=POLICY:e.append('unsupported-policy')
    if completed:
        if run.get('state')!='completed': e.append('incomplete')
        if run.get('errors'): e.append('runtime-errors')
        if run.get('conditions',{}).get('gpuVerified') is not True:e.append('hardware-gpu-unverified')
        if run.get('progress',{}).get('physicsSteps',0)==0:e.append('physics-not-running')
        if not isinstance(run.get('cleanup'),dict) or run['cleanup'].get('ok') is not True:e.append('cleanup-unverified')
        if not run.get('exportHash'):e.append('export-unacknowledged')
        if run.get('progress',{}).get('complete') is not True: e.append('workload-incomplete')
        c=run.get('conditions',{})
        if c.get('quiet') is not True: e.append('quiet-window')
        if c.get('hiddenFrames',0): e.append('hidden')
        if c.get('configurationDrift'): e.append('configuration-drift')
        if any(x in str(c.get('gpu','')).lower() for x in ['swiftshader','llvmpipe','software']): e.append('software-gpu')
    for section,keys in {'progress':['acceptedSeconds','wallSeconds','outerLost','physicsDropped','physicsSteps'], 'conditions':['width','height','dpr','seed'], 'semantic':['populationMin','populationMax','childrenMin','childrenMax'], 'cost':['drawsMin','drawsMax']}.items():
        for key in keys:
            value=run.get(section,{}).get(key)
            if not finite(value) or value<0:e.append(f'{section}.{key}:numeric-required')
            elif section=='conditions' and key in ('width','height','dpr') and value<=0:e.append(f'{section}.{key}:positive-required')
    lo=run.get('semantic',{}).get('populationMin');hi=run.get('semantic',{}).get('populationMax')
    if finite(lo) and finite(hi) and lo>hi:e.append('population-range')
    lo=run['semantic'].get('childrenMin');hi=run['semantic'].get('childrenMax')
    if finite(lo) and finite(hi) and lo>hi:e.append('children-range')
    frames=run.get('frames')
    if not isinstance(frames,list) or not frames: e.append('frames-missing'); return e
    if len(frames)>MAX_FRAMES: e.append('frame-cap')
    for frame in frames:
        if not isinstance(frame,list) or len(frame)!=5 or not all(finite(x) and x>=0 for x in frame) or frame[2]!=int(frame[2]) or frame[2]>4:
            e.append('frame-format');break
    if completed and frames and 'frame-format' not in e:
        expected={'dense-festival-v1':30,'streaming-drive-v1':60}.get(run.get('identity',{}).get('scenario'))
        if expected==30 and any(f[2]!=0 for f in frames):e.append('parked-segment')
        accepted=run.get('progress',{}).get('acceptedSeconds')
        if expected is None:e.append('unknown-scenario')
        elif not finite(accepted) or not expected-.05<=accepted<=expected+.051 or len(frames)<expected/.05-2:e.append('measurement-coverage')
        if any(f[0]<=0 for f in frames):e.append('zero-wall-interval')
        wall=run.get('progress',{}).get('wallSeconds')
        if finite(wall) and finite(accepted) and accepted>wall+.1:e.append('accepted-time-exceeds-wall')
        tolerance=max(1,max(f[0] for f in frames)/500)
        if finite(wall) and abs(sum(f[0] for f in frames)/1000-wall)>tolerance:e.append('wall-coverage')
    if run.get('identity',{}).get('scenario')=='streaming-drive-v1':
        progress=run['progress'];points=progress.get('checkpoints');events=progress.get('streamingEvents')
        if not isinstance(points,list) or len(points)!=4 or any(not isinstance(row,dict) or row.get('segment')!=i or not all(finite(row.get(k)) for k in ('t','x','z','wallSeconds')) for i,row in enumerate(points or [])):e.append('route-checkpoints')
        elif any(points[i]['t']>points[i+1]['t'] or points[i]['wallSeconds']>points[i+1]['wallSeconds'] for i in range(3)):e.append('route-checkpoint-order')
        if not isinstance(events,list) or not events or any(not isinstance(row,list) or len(row)!=3 or not finite(row[0]) or row[1] not in ('load','unload') or not isinstance(row[2],str) for row in events):e.append('streaming-events')
        else:
            for kind,key in [('load','loads'),('unload','unloads')]:
                count=sum(row[1]==kind for row in events)
                if count<1 or progress.get(key)!=count:e.append('streaming-'+key)
        route_wall=progress.get('routeWallSeconds');wall=progress.get('wallSeconds')
        if not finite(route_wall) or route_wall<=0 or (finite(wall) and route_wall>wall+.1):e.append('route-wall-time')
        if 'frame-format' not in e and not set(range(5)).issubset({f[2] for f in frames}):e.append('route-segment-coverage')
    if run.get('overflow'): e.append('overflow')
    return e

def compatibility(run):
    """App and cost counters intentionally excluded: those are allowed to change."""
    i,c=run['identity'],run['conditions']
    return dict(identity={k:i[k] for k in ['harness','scenario','policy','instrumentation']},
                conditions={k:c[k] for k in ['gpu','browser','tier','width','height','dpr','seed']},
                semantic={k:run['semantic'][k] for k in ['contentPolicy','routePolicy']})

def load_run(path):
    """Published comparison inputs require the original acknowledged payload."""
    from pathlib import Path
    path=Path(path)
    raw_path=path.with_name('capture.json')
    if path.stat().st_size>MAX_BYTES or raw_path.stat().st_size>MAX_BYTES:raise ValueError('Capture exceeds byte cap')
    run=json.loads(path.read_text())
    raw=json.loads(raw_path.read_text())
    if not isinstance(run,dict) or not isinstance(raw,dict):raise ValueError('Capture objects required')
    if run.get('exportHash')!=digest(raw):raise ValueError('Durable payload hash mismatch: '+str(path))
    projection={k:v for k,v in run.items() if k not in ('cleanup','exportHash')}
    projection['state']=raw['state']
    if projection!=raw:raise ValueError('Saved run differs from acknowledged payload: '+str(path))
    return run
