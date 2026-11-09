#!/usr/bin/env python3
"""Summarize the predeclared frozen rendering discriminator, preserving raw data."""
import hashlib
import json
from pathlib import Path
import statistics

BUNDLE = Path(__file__).resolve().parent
ROOT = BUNDLE.parents[2]
CAPTURES = ROOT / '.claude/captures/performance-lab/diagnostics'
ROSTER = {
    'high': '20261107-112117-render-probe-high-e0ba69d3',
    'low': '20261107-112252-render-probe-low-aa01f16d',
}

def median(values):
    return statistics.median(values)

result = dict(scope='Frozen rendering attribution; no ordinary frame or device acceptance', tiers={})
for tier, name in ROSTER.items():
    directory = CAPTURES / name
    data = json.loads((directory / 'diagnostic-result.json').read_text())
    owner = json.loads((directory / 'ownership.json').read_text())
    assert data['ok'] and not data['errors'] and owner['cleanup']['ok']
    assert len(data['cases']) == 6
    rows = []
    for case in data['cases']:
        for mechanism in case['mechanisms']:
            blocks = mechanism['blocks']
            assert [b['variant'] for b in blocks] == ['baseline','candidate','candidate','baseline'] * 2
            assert all(len(b['samples']) == 24 for b in blocks)
            times = {variant: [sample['workMs'] for block in blocks if block['variant'] == variant for sample in block['samples']]
                     for variant in ['baseline', 'candidate']}
            pairs = []
            for i in range(0, 8, 2):
                a,b = blocks[i:i+2]
                by_variant = {block['variant']: median([s['workMs'] for s in block['samples']]) for block in [a,b]}
                pairs.append(dict(order=a['variant']+'-first', deltaMs=by_variant['candidate']-by_variant['baseline']))
            order = {name: median([p['deltaMs'] for p in pairs if p['order'] == name]) for name in ['baseline-first','candidate-first']}
            delta = median(times['candidate']) - median(times['baseline'])
            rows.append(dict(mode=case['mode'],time=case['label'],mechanism=mechanism['mechanism'],
                baselineMedianMs=median(times['baseline']),candidateMedianMs=median(times['candidate']),
                deltaMs=delta,pairedMedianDeltaMs=median([p['deltaMs'] for p in pairs]),pairDeltas=pairs,
                orderMedianDeltaMs=order,nominationView=delta<=-1 and all(d<0 for d in order.values()),
                regressionView=delta>.5,submissions=mechanism['submissionComparison'],inventory=mechanism['inventory'],
                candidateCounts=next(b['counts'] for b in blocks if b['variant']=='candidate'),
                constructionMs=[v['ms'] for v in blocks[-1]['constructions']],
                matrixAudit=mechanism.get('matrixAudit')))
    nomination={kind:dict(qualifyingViews=sum(r['nominationView'] for r in rows if r['mechanism']==kind),
                         regressionViews=sum(r['regressionView'] for r in rows if r['mechanism']==kind))
                for kind in ['static-flags','vendor-instances']}
    for kind, counts in nomination.items():
        counts['advances'] = counts['qualifyingViews'] >= 2 and counts['regressionViews'] == 0
    result['tiers'][tier]=dict(directory=str(directory),rawSha256=hashlib.sha256((directory/'diagnostic-result.json').read_bytes()).hexdigest(),
        hardware=data['hardware'],elapsedMs=data['captureElapsedMs'],frames=sum(len(b['samples']) for c in data['cases'] for m in c['mechanisms'] for b in m['blocks']),
        cleanup=owner['cleanup'],restored=data['restored'],nomination=nomination,rows=rows)
    for source,destination in [('diagnostic-result.json',tier+'-render-raw.json'),('ownership.json',tier+'-render-ownership.json'),('diagnostic-input.json',tier+'-render-input.json')]:
        (BUNDLE/destination).write_bytes((directory/source).read_bytes())
result['decision']='No tested rendering mechanism advances under the predeclared filter' if not any(v['advances'] for t in result['tiers'].values() for v in t['nomination'].values()) else 'At least one candidate needs ordinary live-game pilot evidence'
(BUNDLE/'render-summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(decision=result['decision'],tiers={k:dict(frames=v['frames'],nomination=v['nomination'],rows=[{key:r[key] for key in ['mode','time','mechanism','baselineMedianMs','candidateMedianMs','deltaMs']} for r in v['rows']]) for k,v in result['tiers'].items()}),indent=2))
