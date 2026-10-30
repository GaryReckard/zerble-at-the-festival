# Verification evidence

[Contributor documentation](../docs/README.md) · [Pending acceptance](../ROADMAP.md)

These are saved observations, probes, screenshots and test logs. Read each
report's date, source baseline, method and limitations before using its result.
A desktop CPU benchmark is not a phone FPS measurement, and a passing render is
not physical-device acceptance.

## Player progression

- [Festival Passport, October 25](passport/2026-10-25/README.md): pure/integration checks, Low/Mid boots, settings continuity, paused Festival Run and responsive captures.

## Temporary activities

- [Stage audience, parked-cart clearance, soundboard and road patch, October 28](people/stage-audience.md): shared dance motion, reserved chairs/blankets, production fixture results and the exact reported road regression.

- [Hula, frisbee and dance interruption verification](people/temporary-activities.md): production-backed contracts, native fixtures, controlled live-game hula run, and remaining measurement limits.

## People architecture acceptance

- [People locomotion, October 29](people/locomotion.md), followed by the [specialist family coverage](people/locomotion-families.md): shared distance-driven strides, occupied hands, grounded stops, family policies, native Low/Mid evidence and measured buffer/geometry costs.
- [Final coverage and limits](../openspec/changes/people-npc-architecture/acceptance.md): all 17 families, ownership/failure contracts, saved real-game traces and matched Low/Mid topology, with explicit CPU costs and physical-device limits.
- [Before/after visual](people/architecture.html), [source-grounded diagrams](../openspec/changes/people-npc-architecture/architecture-visual.md) and [extension contract](../openspec/changes/people-npc-architecture/extension-guide.md).

## Recent investigations

- [Camp coolers, October 29](coolers/README.md): pooled geometry, collision bounds, campsite integration, day/night captures and Low-tier game boot.

- [Road snapshot CI portability, October 29](roads/2026-10-29-ci-layout/README.md): reproduced Linux x64 failure, field-by-field floating-point diagnosis, angle-only normalization and CI-equivalent validation.

- [Vite migration, October 29](toolchain/2026-10-29-vite.md): build and capture tests, six browser entry pages, Low/Mid gameplay, Pages configuration and deployment limits.

- [Vendor EZ-up continuity, October 29](vendors/2026-10-28-canopies/README.md): shared near/far colors, batched legs, fixed pool limits, native comparisons and live streaming/revisit checks.

- [Lurleen terrain contact, October 28](terrain/2026-10-28-lurleen/README.md): reported seed reproduction, four-wheel support, unchanged behavioral traces and Low/Mid native and live-game checks.

- [Vendor market activity, October 25](vendors/2026-10-25/README.md): opposing customer-facing keepers, real crowd browsing/purchases, bag draw cost, closure and lifecycle regressions.

- [Evening vendors, moonset and Smile Bubbles, October 25](nightlife/2026-10-25/README.md): midnight shop closure, celestial occlusion and the real 1,000-pickup unlock pipeline.

- [Wildlife and scenery, October 25](wildlife/2026-10-25/README.md): bird anatomy/motion, shared tree detail costs, hammock bark anchors, tent palettes and terrain-grounded star commands.

| Evidence | What it establishes |
| --- | --- |
| [Slash commands, October 24](debug-commands/2026-10-24/README.md) | Twenty command grammars, bounded argument dispatch, actual game adapters, contextual completion and live-game checks |
| [Terrain driving proof, October 24](terrain/2026-10-24-driving-proof.md) | Playable authored course, shared cart path, numerical regressions and rendered wheel-ray checks; isolated from the live world |
| [Terrain proposal, October 24](terrain/2026-10-24-proposal.md) | Astra’s source-grounded options, dependencies and proposed acceptance gates; no terrain implementation or runtime acceptance |
| [Campsite life and layouts, October 23](campsites/README.md) | Deterministic camp furniture, granular collisions, seating and sleeping lifecycle, lighting schedules and sandbox captures |
| [One-wheel rider, October 22](one-wheel/README.md) | Seeded road encounters, pedestrian/cart yielding, model animation, resource cleanup and Low/High game checks |
| [Healing Arts tent, October 22](healing-arts/README.md) | Sparse placement, yoga/dance motion, real crowd changeover, lifecycle tests and day/night captures |
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

## Road surfaces and audience placement

- [October 28 road surfaces and organic seating](roads/2026-10-28/README.md): deterministic major-hub asphalt/dirt assignment, shared procedural textures, terrain/distant-road safety, rear chair groups, multi-person blankets, native Low/Mid and real-game evidence.

- [October 28 junction and dirt-repeat corrections](roads/2026-10-28-junctions/README.md): both reported mixed-surface junctions, geometry subtraction, camera-angle checks, a larger dirt tile, fixed-capacity proxy safety and full-game evidence.

- [Festival map, October 29](festival-map/README.md): functional map/storage/input/worker evidence, captures, diagnostic snapshot and remaining device acceptance.
