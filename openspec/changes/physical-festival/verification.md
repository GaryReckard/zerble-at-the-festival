# Verification and acceptance plan

Status: planned, no implementation checks passed by this document. Record results under `verification/physical-festival/` when implementation begins, with actual date, code revision, dependency version, seed, fixture settings, browser/device and commands. Do not invent target hardware, measured capacity or performance results.

## Verification ladder

1. Pure/unit contracts: stable keys, fixed-step bookkeeping, contact routing, socket transforms, incident expiry, sign planning and exclusive transfers.
2. Headless physical fixtures: contact invariants, support continuity, bounded velocities, ground/stack correctness and resource lifetimes using the real adapter.
3. Interaction sandbox: production model/controller/person bindings, repeatable inputs and visually judged motion.
4. Real campsite and hub: actual builders, ownership, registry, terrain, crowd and full frame scheduling.
5. Main game: ready title click, boot, gameplay, console and streaming, including real gesture-sensitive audio verification.
6. Physical devices: allocation/steady-state timing and tier acceptance; software-renderer FPS is never phone evidence.

## Acceptance matrix

| Area | Required positive proof | Required negative/adversarial proof |
| --- | --- | --- |
| Contact feel | Gentle slide, off-center pivot, caught-leg tip, square hit, settling | No constant launch kick, no old bounce plus solver response |
| Ground/static contacts | Slopes, seams, nearby tent/tree proxies | No ground gaps, tunneling at accepted maximum speed or disappearance at frontier |
| Time and frame barriers | Comparable invariants at 30/60/120Hz; authoritative queries and consistent parent/child display | Zero/multiple substeps, hidden timer ticking, actual suspension, Passport pause, capture locks, same-frame star pickup and wall correction |
| Rendering | Correct parts/world pose and visible airborne bounds | Original batch unload, transfer failure, duplicate slots and shared-resource disposal |
| Identity/distance reset | Short return retains damage; safe distant return restores original arrangement | Looking away, nearby boundary crossing, followed chair/carried cup, occupied support teardown, origin duplication, long-travel metadata and reward/progress preservation |
| Generation clearance | Original-content equivalence for matched seed/load order despite runtime displacement | Different moved footprints and sign timing; newly loaded solid intersecting a displaced prop |
| Support | Chair and cup support retained at rest | Retiring a lower stacked object, late activation and contact-group capacity |
| Occupants | Brace, controlled exit, fall and clear get-up | Occupied-origin unload, both loveseat sitters, camp music, failed support adoption, late old release, saturated mandatory release and repeated impact |
| Cooler | Body moves independently; holders follow support; lid parts articulate correctly | Canopy motion, rotating body-mounted handles, duplicate collider or leaked hinge |
| Drinks | One cup moves from hand to holder to free and back | Full holder/hand, two claimants, pool failure, hiding during hoop/instrument/camera poses |
| Signs | Follow an actual advertised route; read from driving approach | Lake bearing, disconnected crossing, omitted target, sign-first/destination-first loading, target unload, duplicate boundary signs and automatic repair |
| Incidents/score | Causal secondary hit and one eligible consequence per victim | Repeated settling penalties, eternal attribution, immunity/ghost transition errors |
| Aftermath | Chair righting and same-object retrieval | Target moves/unloads, competing helper, supporting furniture, repair of an excluded sign |
| Lifecycle | Stable resource counts after repeated complete cycles | Removal in both orders, partial initialization failure and double disposal |

Use a fixed batch of representative seeds plus explicit adversarial scenes; record the batch. For exact replay, pin runtime/version and inputs. Across browsers compare semantic invariants and documented tolerances unless engine bit-exactness has been separately established. Preserve established generation goldens and compare preexisting layout descriptors before/after new decoration.

## Measurements and gates

Record cold dependency load/init, cold model/body allocation, warm physics-step p50/p95/p99, activation spikes, render-transform/upload cost, total frame time, memory/pool high-water marks, draw/triangle counts and active/sleeping/contact counts. Describe sample duration and workload so percentiles are meaningful. Record both isolated fixture and production campsite results against the same baseline. Include bodies, compound-collider counts, simultaneous contact pairs, joints, CCD-enabled bodies, substeps and event processing for sparse motion, dense piles, chain reactions, rapid activation and sleeping neighborhoods. Distinguish mandatory transition queue capacity from coalescible cosmetic feedback.

For attribution, match quality rung, actual DPR, render-target dimensions, viewport, crowd population, time of day and feature state; separately test normal adaptive quality. Record both the shared streaming allowance and physical preparation spend, plus maximum single-unit creation time. Compare existing render buckets, partial updates where supported and active pools only when a changed workload justifies the comparison. Measure sign planning/label cache counts and bytes during travel.

Group 2 (engine proof) sets provisional capacities from real devices; Group 11 (final capacity gates) establishes release limits. A green GPU HUD alone cannot pass a physics CPU gate. If the existing whole-game baseline exceeds a HUD guide, record that baseline and the feature's measured delta rather than claim an unrelated global optimization is complete.

Capture Noon and Midnight and relevant Low/Mid/High paths for visual changes, with no new shadows by default. Inspect labels, changed culling bounds, standing/fallen silhouettes, cup fit and held-hand contact at the normal camera distance. Keep close-up slow motion for diagnosis, not the only proof of player-visible quality.

## Research-derived proof requirements

The [external research synthesis](research-synthesis.md#experiments-to-run-after-the-clean-branch-gate) defines the additional failure cases within the existing task sequence. Record package-version/API evidence, distinguish sensor/start-end events from measured forces, and test full versus partial instance uploads on the pinned renderer. Separate live object/resource counts from retained allocator capacity; no single heap counter establishes complete cleanup. Repeated equal workloads should reach a bounded post-warmup envelope, with unavailable engine-memory telemetry recorded as a limitation.

Do not inherit arbitrary body counts or millisecond budgets from the reports. Declare device acceptance limits from the whole-game baseline before testing candidates. A cube promotion demo that changes height, omits teardown or bypasses production ownership cannot pass the real-chair gate. Worker experiments remain conditional on measured need and must include end-to-end latency and lifecycle behavior.

## Harness ownership

Prefer an existing suitable server and in-app/real browser. Always use `mute=1` except a bounded explicit audio check, then restore mute. Close test tabs and stop task-owned servers. Standalone automation requires unique sessions, recorded preexisting/new PIDs, hard timeouts, `finally` teardown and exact-PID orphan checks; stop after 60 seconds without useful progress. Do not launch concurrent standalone WebGL systems or use the prohibited layout capture path before its cleanup is fixed.

## Release evidence checklist

- Check/build output and the exact source revision.
- Scenario inputs, counters and positive/negative invariant results.
- Main-game ready-title boot and console evidence, with audio/device limits stated.
- Noon/Midnight captures and relevant performance-tier comparison.
- Physical-device measurements and selected numeric limits.
- Recorded feel/score decisions, conditional-extension outcomes and any remaining acceptance gaps.
- Updated CHANGELOG, ROADMAP, developer documentation, capability specs and final review disposition.

Documentation-only validation for this planning turn is narrower: OpenSpec validation, generated README freshness, local link/anchor checks, whitespace checks and an end-to-end reading of headings/cross-references. No game boot is required for a plan-only change.
