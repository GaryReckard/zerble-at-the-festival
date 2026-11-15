#!/usr/bin/env python3
"""Reproduce descriptive guided-window overhead and held-out route checks."""
import json, math, statistics, sys
from pathlib import Path

def read_run(directory):
    directory = Path(directory)
    report = json.loads((directory/'device-report.json').read_text())
    metadata = json.loads((directory/'metadata.json').read_text())
    ownership = json.loads((directory/'ownership.json').read_text())
    route = report['session']['autopilot']
    assert ownership['cleanup']['ok'] and ownership['state'] == 'collected'
    assert report['valid'] and report['reason'] == 'complete' and route['complete']
    assert route['checkpointCount'] == 4 and not report['errors'] and not report['visibilityEvents']
    assert report['session']['tier'] == 'low' and report['session']['qualityPolicy'] == 'baseline'
    drive = [s for s in report['samples'] if s['phase'] == 'drive' and s.get('frame')]
    p95 = [s['frame']['wallP95'] for s in drive if s['frame'].get('wallP95') is not None]
    groups = [g for s in drive for g in (s['frame'].get('detail') or {}).get('groups',[]) if g['phase'] == 'drive']
    sections = {}
    count = sum(g['frames'] for g in groups)
    for g in groups:
        for key, value in g['sectionMs'].items(): sections[key] = sections.get(key,0) + value
    pending = [s for s in drive if s.get('ffRequestedCell') != s.get('ffPublishedCell')]
    freshness = {
        'maxSampledCells': max((s.get('ffCellsSincePublication',0) for s in drive),default=0),
        'maxStreak': max((s.get('ffSupersededStreakMax',0) for s in drive),default=0),
        'maxSampledPendingAgeMs': max((s.get('ffPublishedAgeMs') or 0 for s in pending),default=0),
        'firstRequestMs': max((s.get('ffFirstRequestToPublicationMs') or 0 for s in drive),default=0),
        'maxFarFieldDrivingMs': max((s['frame'].get('worldPartsMax',{}).get('farField',0) for s in drive),default=0),
        'publicationsDuringDrive': (drive[-1].get('ffPublications',0)-drive[0].get('ffPublications',0)),
        'finalCellAgrees': report['samples'][-1].get('ffPublishedCell') == report['samples'][-1].get('ffRequestedCell'),
    } if metadata['mode'] == 'detail' else None
    return dict(directory=str(directory.resolve()),mode=metadata['mode'],app=metadata['app'],build=metadata['build'],harness=metadata['harness'],
        drivingMedianWindowP95Ms=statistics.median(p95),drivingWorstWindowP95Ms=max(p95),
        driveWindows=len(p95),route=route,childPopulation=report['session']['childPopulation'],adultPopulation=report['session']['adultPopulation'],
        sectionMeanMs={k:v/count for k,v in sections.items()} if count else {},freshness=freshness)

def thresholds(training):
    f=training['freshness']
    return dict(farFieldDrivingMaxMs=50,allowedCells=max(1,f['maxSampledCells']+1),allowedStreak=max(1,f['maxStreak']+1),
        pendingAgeMs=max(2000,math.ceil(f['maxSampledPendingAgeMs']/1000)*1000+1000),
        firstRequestMs=math.ceil(f['firstRequestMs']/1000)*1000+1000)

if __name__ == '__main__':
    if sys.argv[1] == '--calibrate':
        run=read_run(sys.argv[2]); print(json.dumps(dict(training=run['directory'],thresholds=thresholds(run)),indent=2)); sys.exit()
    frozen=json.loads(Path(sys.argv[1]).read_text())
    runs=[read_run(p) for p in sys.argv[2:]]
    assert len(runs)==4 and [r['mode'] for r in runs]==['basic','detail','detail','basic']
    assert len({(r['app'],r['build'],r['harness']) for r in runs})==1
    assert len({r['childPopulation'] for r in runs})==1
    basic=statistics.mean(runs[i]['drivingMedianWindowP95Ms'] for i in [0,3])
    detail=statistics.mean(runs[i]['drivingMedianWindowP95Ms'] for i in [1,2])
    limit=max(2,basic*.1); delta=detail-basic
    f=runs[2]['freshness']; t=frozen['thresholds']
    checks=dict(duration=f['maxFarFieldDrivingMs']<=t['farFieldDrivingMaxMs'],cells=f['maxSampledCells']<=t['allowedCells'],
        supersession=f['maxStreak']<=t['allowedStreak'],pendingAge=f['maxSampledPendingAgeMs']<=t['pendingAgeMs'],
        firstRequest=f['firstRequestMs']<=t['firstRequestMs'],progress=f['publicationsDuringDrive']>0 and f['finalCellAgrees'])
    result=dict(scope='Descriptive guided-window incremental detail overhead on this reserved Mac; not calibrated exact-frame optimization acceptance or iPad evidence.',
        runs=runs,overhead=dict(basicMs=basic,detailMs=detail,incrementalMs=delta,thresholdMs=limit,accepted=delta<=limit,
        basicRepeatSpreadMs=abs(runs[0]['drivingMedianWindowP95Ms']-runs[3]['drivingMedianWindowP95Ms'])),
        frozenPublicationThresholds=frozen,heldOutB2=dict(checks=checks,accepted=all(checks.values())),
        allDetailedDurationCheck=dict(thresholdMs=50,observedMs=[r['freshness']['maxFarFieldDrivingMs'] for r in runs if r['freshness']],accepted=all(r['freshness']['maxFarFieldDrivingMs']<=50 for r in runs if r['freshness'])),
        limits=['One-second summaries are not a pooled frame p95.','Sampled freshness can miss shorter excursions.','This is a four-run check, not a fresh calibrated statistical holdout.','Separate driver and new telemetry costs remain included in both arms as applicable.'])
    print(json.dumps(result,indent=2))
