# Woodland camps and fireside ensembles

October 23, 2026. This uncommitted continuation builds on the campsite optimization commit `ed7433e`; no deployment was performed.

## Behavior and verification

| Behavior | Implementation and evidence |
| --- | --- |
| Substantial live-v2 forests contain shared camp households | [Pure planner](../../../src/woodlandCamping.js), [production builder](../../../src/chunks.js), `bin/test-woodland-camping`: 63 districts and 392 planned pitches across five seeds, independent venue/road/water checks, query-window and seed invariance |
| Sleeping tents cluster more tightly around one shared hearth/kitchen | [Recipes](../../../src/campPlanning.js), [assembler](../../../src/models/campsite.js): sleeping-only satellites omit redundant chairs, use a 1.3m local tent radius and 72% of the original neighborhood offsets. `bin/test-campsite-layout` builds actual models against earlier neighboring trunks: 61 of 67 planned pitches retained across 11 districts, with at least three camps in each |
| Camps retain grass between tents | Internal corridors reserve tree clearance but create no path meshes; only the approach from the road is visible. The production integration test explicitly checks invisible internal corridors |
| Neighbor chunks cannot plant trees on future camps | All nearby chunks query the same canonical plan before tree/shrub scatter; owner checks prevent duplicate households. Test coverage includes cold neighboring queries, isolated RNG and rejected-host suppression |
| Nearby campers play acoustic music in the evening | [Activity manager](../../../src/campJamActivity.js), [Crowd integration](../../../src/crowd.js), [hearth metadata](../../../src/campRegistry.js): fetch, carry, hearth-side chair/standing placement, coordinated play and return, with exclusive claims and interruption/unload teardown. Far kitchen chairs are excluded |
| Five instrument families and bounded audio | [Pooled models](../../../src/models/campInstruments.js), [deterministic music](../../../src/campMusic.js), [Sound bridge](../../../src/sound.js): five kinds, 60 actor attachment cases, at most four simultaneous parts and 32 voices, overdue beat skipping, pre-gesture cancellation/adoption and complete teardown |

The full `npm run check` passed; [saved output](checks.log) records its scope. Additional focused music checks cover the final hearth-seat restriction and hidden-actor interaction exclusions. Rendering stubs establish geometry/state contracts, while the browser checks below establish actual integration and raster appearance.

## Browser evidence

All URLs used `mute=1` and seed 1977, reusing Gary's existing server on port 8765. The real game was started by clicking its ready Just Cruisin' plank in High and Low. Teleporting to **Woodland campground** produced **six registered woodland camps and four chairs** in both tiers, rather than relying on planned markers. No warning/error console entries were reported.

- [Low preview at noon](low-noon.jpg) and [midnight](low-midnight.jpg) show the compact forest group without internal dirt paths.
- [Live High campground](game-high-camp.jpg) and [live Low midnight](game-low-entry.jpg) show the same production placement through the actual game.
- [Instrument lineup at noon](instruments-noon.jpg) and [midnight](instruments-midnight.jpg) show the five actual pooled models.
- [The hearth-side duet](fireside-duet.jpg) captures the real crowd preview. The `camp_jam` preview was observed progressing through fetching and approaching into a bass/banjo duet near the hearth, then naturally returning instruments and clearing both jobs. Its HUD exposes the instrument, stage and elapsed time for repeat inspection.

## Limits and ownership

These are desktop correctness checks, not physical-phone performance measurements or audible musical-quality approval. The launch mute remained enabled. The added households currently appear in near-field chunks; far-field forest proxies do not depict their individual tents. The wider game's existing draw/triangle counters still exceed nominal tier guides, so successful checks do not establish those budgets were met. Actual collision preflight may omit a planned sleeping pitch when its doorway or props would conflict, retaining the shared host.

Only the intentional woodland preview is left available for Gary; temporary game/model/activity tabs are closed after verification. No standalone browsers or development servers were started. The one-time October 24, 12:15 a.m. Eastern continuation remains armed to resume or polish this work.

## October 24 follow-up

The [completed wakeup report](../../debug-commands/2026-10-24/README.md) records a guarded lake-envelope placement correction, new live Low/High evidence for the formerly empty second campground and the expanded command inspection surface. Both one-time wakeups have now been handled and paused.
