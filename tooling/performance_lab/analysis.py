"""Conservative finite-sample rules. Experimental units are runs, never frames."""
import json,statistics
from .contract import POLICY,digest,errors,summarize,compatibility

METRICS={'wallP95':2.0,'stallRate':0.1,'wallMedian':1.0,'wallP99':3.0,'severeRate':0.05,'completionSeconds':2.0,'timeLost':0.5}
PRIMARY={'wallP95','stallRate'}
ORDER=['A','B','B','A','A','B','B','A']
PAIRS=[(0,1),(3,2),(4,5),(7,6)]

def common(runs):
    reasons=[]
    if not runs:return ['empty-runs']
    ids=[]
    for index,r in enumerate(runs):
        invalid=errors(r)
        reasons += [f'run-{index}:{e}' for e in invalid]
        if not invalid:ids.append(r['identity']['runId'])
    if len(ids)!=len(set(ids)):reasons.append('duplicate-run')
    if reasons:return reasons
    if any(compatibility(r)!=compatibility(runs[0]) for r in runs):reasons.append('incompatible-conditions')
    return reasons

def calibrate(runs):
    if not isinstance(runs,list):return dict(verdict='comparison invalid',reasons=['runs-array-required'])
    reasons=common(runs)
    if len(runs)<4:reasons.append('four-calibration-runs-required')
    if not reasons:
        if len({(r['identity']['app'],r['identity']['build']) for r in runs})!=1:reasons.append('calibration-source-mismatch')
        if any(r['identity'].get('injectionMs',0) for r in runs):reasons.append('calibration-injection')
    if reasons:return dict(verdict='comparison invalid',reasons=reasons)
    stats=[summarize(r) for r in runs]
    thresholds={k:max(floor,max(s[k] for s in stats)-min(s[k] for s in stats)) for k,floor in METRICS.items()}
    segmentThresholds={key:max(2,max(row['segments'][key]['wallP95'] for row in stats)-min(row['segments'][key]['wallP95'] for row in stats)) for key in stats[0]['segments'] if key!='4'}
    population=[r['semantic'][k] for r in runs for k in ['populationMin','populationMax']]
    # Predeclared 10% semantic population tolerance, never draw-count equality.
    bounds=[min(population)*.9,max(population)*1.1]
    children=[r['semantic'][k] for r in runs for k in ['childrenMin','childrenMax']]
    childBounds=[min(children)*.9,max(children)*1.1]
    stable=thresholds['wallP95']<=max(10,statistics.median(s['wallP95'] for s in stats)*.5)
    return dict(schema=POLICY,state='frozen' if stable else 'unstable',verdict='no detectable change' if stable else 'comparison invalid',
        reasons=[] if stable else ['unstable-calibration'],identity=compatibility(runs[0]),app=runs[0]['identity']['app'],build=runs[0]['identity']['build'],
        runIds=[r['identity']['runId'] for r in runs],thresholds=thresholds,populationBounds=bounds,childrenBounds=childBounds,
        summaries=stats,segmentThresholds=segmentThresholds,claim='finite-sample noise envelope; not a confidence interval')

def compare(runs,calibration,holdout=None,validation=False):
    if not isinstance(runs,list) or not isinstance(calibration,dict):return dict(verdict='comparison invalid',reasons=['invalid-analysis-container'])
    reasons=common(runs)
    if calibration.get('state')!='frozen' or calibration.get('schema')!=POLICY:reasons.append('calibration-not-frozen')
    if len(runs)!=8:reasons.append('two-ABBA-blocks-required')
    if not reasons and any(compatibility(r)!=calibration['identity'] for r in runs):reasons.append('calibration-identity')
    if not reasons and any(r['identity']['runId'] in calibration.get('runIds',[]) for r in runs):reasons.append('calibration-data-reused')
    if not validation:
        if not isinstance(holdout,dict) or holdout.get('verdict')!='no detectable change' or not holdout.get('holdout'):reasons.append('independent-holdout-required')
        elif holdout.get('calibrationHash')!=digest(calibration):reasons.append('holdout-policy-mismatch')
        elif not reasons and set(holdout.get('runIds',[])) & {r['identity']['runId'] for r in runs}:reasons.append('holdout-data-reused')
    if not reasons:
        for label in ('A','B'):
            values=[r for r,l in zip(runs,ORDER) if l==label]
            if len({(r['identity']['app'],r['identity']['build'],r['identity'].get('injectionMs',0)) for r in values})!=1:reasons.append('variant-identity-changed')
        baseline=[r for r,l in zip(runs,ORDER) if validation or l=='A']
        if any(r['identity']['app']!=calibration['app'] or r['identity']['build']!=calibration['build'] or r['identity'].get('injectionMs',0)!=0 for r in baseline):reasons.append('calibrated-baseline-mismatch')
        lo,hi=calibration['populationBounds']
        if any(r['semantic']['populationMin']<lo or r['semantic']['populationMax']>hi for r in runs):reasons.append('semantic-population-drift')
        lo,hi=calibration['childrenBounds']
        if any(r['semantic']['childrenMin']<lo or r['semantic']['childrenMax']>hi for r in runs):reasons.append('semantic-child-population-drift')
    result=dict(policy=POLICY,verdict='comparison invalid',reasons=reasons,runIds=[r.get('identity',{}).get('runId') if isinstance(r,dict) and isinstance(r.get('identity'),dict) else None for r in runs],holdout=validation,calibrationHash=digest(calibration))
    if reasons:return result
    stats=[summarize(r) for r in runs];result['runs']=stats;metrics={}
    for key in METRICS:
        deltas=[stats[b][key]-stats[a][key] for a,b in PAIRS]
        change=statistics.median(deltas);threshold=calibration['thresholds'][key]
        direction=1 if change>threshold and sum(d>threshold for d in deltas)>=3 else -1 if change<-threshold and sum(d<-threshold for d in deltas)>=3 else 0
        metrics[key]=dict(change=change,threshold=threshold,pairedChanges=deltas,direction=direction)
    for segment,threshold in calibration.get('segmentThresholds',{}).items():
        deltas=[stats[b]['segments'][segment]['wallP95']-stats[a]['segments'][segment]['wallP95'] for a,b in PAIRS]
        change=statistics.median(deltas)
        direction=1 if change>threshold and sum(d>threshold for d in deltas)>=3 else -1 if change<-threshold and sum(d<-threshold for d in deltas)>=3 else 0
        metrics['segment-'+segment+'-wallP95']=dict(change=change,threshold=threshold,pairedChanges=deltas,direction=direction)
    # Material baseline drift invalidates an experiment; never delete an outlier.
    for label in ('A','B'):
        indexes=[n for n,l in enumerate(ORDER) if l==label]
        early=statistics.median(stats[n]['wallP95'] for n in indexes[:2]);late=statistics.median(stats[n]['wallP95'] for n in indexes[2:])
        if abs(late-early)>calibration['thresholds']['wallP95']*2:result['reasons'].append(f'{label}-session-drift')
    result['metrics']=metrics
    if result['reasons']:return result
    result['verdict']='regressed' if any(m['direction']>0 for m in metrics.values()) else 'improved' if any(metrics[k]['direction']<0 for k in PRIMARY) else 'no detectable change'
    if validation and result['verdict']!='no detectable change':result['reasons'].append('fresh-holdout-failed');result['verdict']='comparison invalid'
    result['injectedWorkMs']=[statistics.median(f[4] for f in r['frames']) for r in runs]
    return result

def readable(report):
    lines=[f"Verdict: {report['verdict']}"]
    lines += ['Reason: '+r for r in report.get('reasons',[])]
    for key,row in report.get('metrics',{}).items():lines.append(f"{key}: paired median change {row['change']:.3f}; frozen threshold {row['threshold']:.3f}")
    for index,row in enumerate(report.get('runs',[])):lines.append(f"Run {index+1}: median {row['wallMedian']:.2f} ms; p95 {row['wallP95']:.2f}; worst {row['worstWall']:.2f}; stalls >50 {row['over50']}; elapsed {row['wallSeconds']:.2f}s")
    for index,row in enumerate(report.get('runs',[])):
        for segment,stats in row.get('segments',{}).items():lines.append(f"  Run {index+1}, segment {segment}: p95 {stats['wallP95']:.2f} ms; CPU work p95 {stats['workP95']:.2f}; stalls >50 {stats['over50']}")
    lines.append('Scope: recorded desktop scenario/settings only; not subjective, phone, Auto or cold-cache acceptance.')
    return '\n'.join(lines)

def suite_verdict(results):
    if not results:return 'comparison invalid'
    verdicts=[r['verdict'] for r in results.values()]
    return next((v for v in ('comparison invalid','regressed','improved') if v in verdicts),'no detectable change')
