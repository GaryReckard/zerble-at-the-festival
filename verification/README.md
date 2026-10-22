# Verification evidence

[Contributor documentation](../docs/README.md) · [Pending acceptance](../ROADMAP.md)

These are saved observations, probes, screenshots and test logs. Read each
report's date, source baseline, method and limitations before using its result.
A desktop CPU benchmark is not a phone FPS measurement, and a passing render is
not physical-device acceptance.

## Recent investigations

| Evidence | What it establishes |
| --- | --- |
| [Registry maintenance, October 22](performance/2026-10-22/index-maintenance/README.md) | Paired CPU measurements, exact candidate-order tests and Low/High streaming checks |
| [Post-process first use, October 22](performance/2026-10-22/render-stall/README.md) | Bloom/Trip preparation, program-count probes and the limits of the device-stall attribution |
| [Guided iPhone quality comparison, October 22](performance/2026-10-22/guided-quality-comparison.md) | Auto versus Sustained observations, differing routes, tagged lag and the phone-lock interruption |
| [GA configuration, October 21](performance/2026-10-21/GA-SETUP.md) | Registered quality dimensions and metrics; configuration alone does not prove production ingestion |
| [Particle and query checks, October 11](performance/2026-10-11/README.md) | Resource lifetime, bubble submissions and ordered registry indexes |
| [Guided device captures, October 9](performance/2026-10-09/guided-playtests.md) | Earlier desktop/phone driving and Trip observations |

## Feature evidence

- [Bubble Upgrades handoff](bubble-upgrades/HANDOFF.md)
- [Lantern parade](puppet-parade/README.md)
- [Festival performance and music](festival-performance/README.md)
- [Nut Wagon gameplay](nut-wagon/GAMEPLAY.md) and [monk parties](nut-wagon/MONKS.md)
- [Bubble pop](bubble-pop/README.md)

## Layout baseline

[MANIFEST.md](MANIFEST.md) describes the original June built-layout capture
windows, and [baseline.md](baseline.md) records their linter findings. These
are historical baselines, not an inventory of every verification artifact or
a claim that today's world must match every June snapshot.

## Adding evidence

Use a named feature folder or `performance/YYYY-MM-DD/` with a short report
that names the source revision, reproducible commands, results and limits.
Keep raw device uploads and tokenized capture URLs out of Git; the local
capture server writes to ignored `.claude/captures/`. Promote only the evidence
needed to support a change, with private details removed. Link unfinished
acceptance from the roadmap and link the report from the relevant changelog
entry when behavior ships.
