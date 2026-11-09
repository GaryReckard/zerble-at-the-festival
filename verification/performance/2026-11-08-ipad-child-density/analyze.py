#!/usr/bin/env python3
"""Reproduce this diagnostic's checks; does not issue a performance verdict."""
import hashlib
import json
from pathlib import Path
import statistics
ROOT = Path(__file__).resolve().parent

def read(name):
    return json.loads((ROOT / name).read_text())

def write(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2) + '\n')

report = read('baseline-capture.json')
pilot = report['session']['autopilot']
assert report['valid'] is True and pilot['complete'] and pilot['checkpointCount'] == 4
assert not report['errors'] and not report['visibilityEvents']
write('baseline-analysis.json', {
    'valid': True, 'route': pilot, 'durationSeconds': report['activeDurationS'],
    'errors': len(report['errors']), 'visibilityEvents': len(report['visibilityEvents']),
    'sourceApp': read('baseline-snapshot.json')['app'],
    'baselineSha256': hashlib.sha256((ROOT / 'baseline-capture.json').read_bytes()).hexdigest(),
    'maxObservedPlanningStepMs': max(s.get('ffCold', 0) or 0 for s in report['samples']),
    'qualityLevels': sorted(set(s['quality'] for s in report['samples'])),
    'phaseFpsMedian': {phase: statistics.median(s['fps'] for s in report['samples'] if s['phase'] == phase)
                       for phase in ['settle', 'parked', 'drive', 'parked-after']},
    'worstDriveWorldFrame': max((e for e in report['worldUpdateTimings']['worstFrames'] if e['phase'] == 'drive'), key=lambda e: e['worldMs']),
    'limits': ['Single physical-iPad diagnostic; Auto changed quality and resolution.',
               'No reduced-child physical-iPad run yet; no calibrated gain verdict.',
               'Elapsed intervals include scheduling and collection costs.'],
})
terrain, flat = read('far-field-probe.json'), read('far-field-flat-probe.json')
assert len(terrain['anchors']) == len(flat['anchors']) == 3
rows = []
for a, b in zip(terrain['anchors'], flat['anchors']):
    assert (a['x'], a['z'], a['descriptorSha256']) == (b['x'], b['z'], b['descriptorSha256'])
    def stage(anchor, name):
        return max(c['ms'] for c in anchor['calls'] if c['name'] == name)
    rows.append({'anchor': [a['x'], a['z']], 'descriptorSha256': a['descriptorSha256'],
                 'terrainApplyMs': stage(a, '_applySnapshot'), 'flatApplyMs': stage(b, '_applySnapshot'),
                 'terrainRoadsMs': stage(a, '_writeRoads'), 'flatRoadsMs': stage(b, '_writeRoads')})
write('far-field-subtraction.json', {
    'scope': 'Offline Node CPU attribution, not a shipping candidate or calibrated device/frame comparison. No runtime landscape clearance policy installed. Terrain/draping intentionally differ; planned descriptors match. Separate cold processes; no browser capture ran concurrently.',
    'anchors': rows,
})
print('PASS valid physical-iPad route and identical planned descriptors in the offline terrain subtraction; no optimization verdict.')
