#!/usr/bin/env python3
"""Re-run the real comparison CLI against a promoted, ordered evidence bundle.

No browser launches or threshold changes. The original controller reports stay
untouched; byte-independent JSON equality is required for every regenerated report.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('bundle', type=Path, help='directory containing inventory.json and captured run folders')
args = parser.parse_args()
bundle = args.bundle.resolve()
inventory = json.loads((bundle / 'inventory.json').read_text())
receipt = []

def regenerate(folder, name, paths, flags):
    expected = json.loads((folder / name).read_text())
    with tempfile.TemporaryDirectory(prefix='zerble-regenerate-') as temporary:
        output = Path(temporary) / name
        command = [str(ROOT / 'bin/compare-perf-runs'), *flags, '--output', str(output), *map(str, paths)]
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
        actual = json.loads(output.read_text())
        expected_code = 2 if expected['verdict'] == 'comparison invalid' else 1 if expected['verdict'] == 'regressed' else 0
        if result.returncode != expected_code or actual != expected:
            raise RuntimeError(f'Regeneration mismatch: {folder.name}/{name}: {result.stdout} {result.stderr}')
        receipt.append(dict(report=str((folder / name).relative_to(bundle)), verdict=actual['verdict'], exitCode=result.returncode, exactJsonMatch=True))

for tier in inventory['tiers']:
    for scenario in inventory['scenarios']:
        folder = bundle / (tier + '-' + scenario)
        calibration_path = folder / 'calibration.json'
        holdout_path = folder / 'holdout.json'
        comparison_path = folder / 'comparison.json'
        if calibration_path.exists():
            calibration = json.loads(calibration_path.read_text())
            regenerate(folder, 'calibration.json', [bundle / run_id / 'run.json' for run_id in calibration['runIds']], ['--calibrate'])
        if holdout_path.exists():
            holdout = json.loads(holdout_path.read_text())
            regenerate(folder, 'holdout.json', [bundle / run_id / 'run.json' for run_id in holdout['runIds']], ['--calibration', str(calibration_path), '--validate-holdout'])
        if comparison_path.exists():
            comparison = json.loads(comparison_path.read_text())
            regenerate(folder, 'comparison.json', [bundle / run_id / 'run.json' for run_id in comparison['runIds']], ['--calibration', str(calibration_path), '--holdout', str(holdout_path)])

if not receipt:
    raise RuntimeError('No analysis reports found')
print(json.dumps(dict(state='passed', reports=receipt), indent=2))
