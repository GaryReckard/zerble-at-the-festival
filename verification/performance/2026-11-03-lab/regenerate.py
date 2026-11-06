#!/usr/bin/env python3
"""Regenerate saved acceptance analysis offline without changing any capture."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tooling'))
from performance_lab.contract import load_run,digest,summarize
from performance_lab.analysis import calibrate,compare
bundle=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).with_name('acceptance')
results={}
for scenario in ('dense-festival-v1','streaming-drive-v1'):
 folder=bundle/scenario
 def saved(name):return json.loads((folder/(name+'.json')).read_text())
 def runs(report):return [load_run(bundle/runId/'run.json') for runId in report['runIds']]
 if not (folder/'calibration.json').exists():
  print(scenario+': incomplete acceptance, no saved calibration');continue
 original=saved('calibration');cal=calibrate(runs(original));assert digest(cal)==digest(original),'Calibration differs'
 print(scenario+': calibration regenerated exactly')
 if (folder/'overhead.json').exists():
  overhead=saved('overhead');stats=[summarize(r) for r in runs(overhead)]
  delta=(stats[1]['wallP95']+stats[2]['wallP95']-stats[0]['wallP95']-stats[3]['wallP95'])/2
  assert delta==overhead['incrementalP95'] and overhead['accepted']==(delta<=overhead['threshold'])
  print(scenario+': overhead agrees with raw-frame quantiles and saved threshold')
 if not (folder/'holdout.json').exists():continue
 original=saved('holdout');held=compare(runs(original),cal,validation=True);assert digest(held)==digest(original),'Holdout differs'
 print(scenario+': holdout regenerated exactly, '+held['verdict'])
 if not (folder/'sensitivity.json').exists():continue
 original=saved('sensitivity');candidate=compare(runs(original),cal,held);assert digest(candidate)==digest(original),'Sensitivity differs'
 results[scenario]=candidate
 print(scenario+': sensitivity regenerated exactly, '+candidate['verdict'])
accepted=len(results)==2 and all(r['verdict']=='regressed' for r in results.values()) and json.loads((bundle/'result.json').read_text())['state']=='accepted'
print('Two-scenario injected-cost acceptance: '+('accepted' if accepted else 'not established'))
raise SystemExit(0 if accepted else 2)
