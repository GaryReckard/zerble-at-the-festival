# Street Creature Parade Replacement

**Status:** Full roster implemented by Astra and approved by Gary for commit. Device-test limits remain in the evidence packet. **Author:** Astra. **Date:** 2026-10-12.
**Source baseline:** `d505cb9`. Recheck the working tree and cited symbols before editing.

**TL;DR:** Replace the six generic floating heads with a handmade lantern procession: a tall heron, a red dragon carried by a small team, a seahorse, a jellyfish, and two smaller community lanterns. Build and review the heron first in the existing entity sandbox, then complete the roster and integrate it with the existing parade controller. Preserve the festival's stylized look while making the construction, silhouettes, and human operation recognizable.

This is a standalone implementation handoff, not an OpenSpec change or a completed council review. Gary requested planning now and implementation by another agent, followed by Astra's review. The checkboxes below are the execution record; leave them unchecked until their evidence exists.

**2026-10-12 implementation update:** Gary asked Astra to take over Sol's incomplete heron proof and build out the procession, superseding the intermediate stop-for-heron-approval gate. All six subjects, moving supports/carriers, controller spacing/colliders, named sandbox entries, and real-Three regression tests are implemented. The source photographs are visible in Astra's original conversation but are not redistributed in the repo. [The current evidence packet](verification/puppet-parade/README.md) is authoritative for completed verification and remaining limits; the original checklist below is retained as the handoff history, not a claim that every planned device/performance check has passed.

## Contents

1. [Scope](#scope)
2. [Visual References](#visual-references)
3. [Code Boundaries](#code-boundaries)
4. [Construction Direction](#construction-direction)
5. [Implementation Checklist](#implementation-checklist)
6. [Review Packet](#review-packet)
7. [Agent Prompts](#agent-prompts)

## Scope

The recommendation is one mixed procession that remains present by day and illuminates at night. This improves the existing encounter without adding a scheduler, inventory, crafting, quests, or crowd-recruitment AI. The performers carry their lanterns in daylight too; the roster does not swap at dusk.

The first complete roster has six independently moving units, in this order: **heron, red dragon, seahorse, jellyfish, moon lantern, star lantern**. A unit includes its carrier or carrier team. The two smaller lanterns create human-scale community participation without simulating hundreds of followers. Keep all six subjects on every performance tier; simplify detail before removing identity.

The woodland giant and pea-pod costumes in Gary's photos are useful references for visible operators and handmade surfaces, but are not extra deliverables in this pass. Mushrooms, moths, butterflies, pufferfish, and lantern workshops from Gemini's text are outside this roster. This is a deliberate scope choice, not a claim that those subjects do not appear at the real event.

**Review cadence:** implement the harness and heron, stop for a visual-direction review, then proceed with the rest after approval. This prevents an expensive correction across six finished models. It is a review checkpoint, not permission to ship a heron-only replacement as complete.

## Visual References

The primary evidence is the five photos Gary attached to the planning conversation on 2026-10-12, identified below by subject and order. They have not been saved into this repository, and no photographer, source URL, license, exact dimensions, or real-world rig engineering was verified. The next agent needs those same attachments for direct visual comparison; the descriptions preserve the direction if chat context is lost. Record any subsequently supplied local paths or original URLs here. Do not invent paths or publish the photos as game assets without permission.

Gemini's prose is a research lead, not verified historical documentation. In particular, the first photo reads as **pale lavender/white illuminated paper**, not a uniformly saturated blue bird, and the dragon photo does not establish a chain of independently articulated body segments. Exact height, the name "Billie," founding dates, and materials such as coffee filters should not become factual player-facing claims without a primary source.

| Reference | Observable details | Translation into the game |
|---|---|---|
| Photo 1: illuminated heron | Very long narrow neck with a deep lower bend; small head; long straight pointed beak with a dark split; yellow eye; swept folded wings; thin angular legs; lavender-white paper with an irregular dark framework and scattered bright spots; operator and control pole visible below. | Make the profile unmistakably avian before adding glow. Use a slim bent neck, tapered beak, layered folded-wing silhouette, and sparse dark ribs. Preserve the pale shell and darker beak. The body is not an inflated cartoon head. |
| Photo 2: woodland giant | Golden-green sculpted face, leaf crown, hanging blue-green beard strips, long brown draped torso and sagging sleeves, oversized green hands, visible people operating hand poles. | Reference for gravity, fabric weight, and visible puppeteering, not a required model. A carried object should look supported and manipulated, rather than hovering independently. |
| Photo 3: pea-pod costumes | Pointed green pod outlines, three bulging peas per costume, circular vent-like upper details, black-clad human limbs outside the costume. | Reference for rough handmade forms and readable human scale, not a required model. Avoid converting the entire parade into polished fantasy animals. |
| Photo 4: illuminated seahorse | Tall narrow profile; downward horse-like snout; ridged back; pale lavender paper; dark transverse ribs; round bright eye; small side fin; tail hooks forward into a tight curl; visible pole carrier. | Give the tail an actual open negative space, a projecting snout, and a ridged back. Use the same paper treatment as the heron with a distinct silhouette. |
| Photo 5: dragon procession | Long orange-red dragon, upright neck, angular snout, broad lateral wings, dorsal triangles, curled tail, yellow-hot belly, visible rib grid, several supporting poles and people. Beside it: a tall pale jellyfish-like bell with long loose streamers and light strings, plus a mottled warm sphere. Smaller hand-carried lights appear among the crowd. | Keep the dragon's warm core and red perimeter, and show a team carrying it. Contrast with a cool jellyfish and small warm moon/star lanterns. Match the visible construction rather than inventing flight or fire-breathing behavior. |

### Proposed Proportions

These are **game-space starting dimensions**, not measurements of the real puppets. Use an ordinary `buildSimpleNPC` carrier, approximately 1.9 m tall, as the ruler (`src/models/puppet.js:191-263`). Adjust the proportions against the photos and record the final bounds in the review packet.

| Unit | Initial envelope | Required identifying features |
|---|---|---|
| Heron | Head roughly 5.5-6 m above ground; body around 3 m; shell about 1.2 m wide; beak around 1 m long. | Narrow bent neck dominates the height; head is small relative to body; swept wings, pointed beak, thin articulated-looking legs, visible support. |
| Dragon | Roughly 5.5-6.5 m nose-to-tail, 3-4 m wing span, head around 4 m high. | Raised neck and distinct snout, broad thin wings, tapering curled tail, dorsal triangles, dark ribs, three visible carriers/poles. |
| Seahorse | Top around 4.5 m, shell about 2.5-3 m tall. | Horse-like head, narrow belly, back ridge, small fin, open curled tail. |
| Jellyfish | Bell around 4 m high and 1.5 m wide; hanging ribbons end above people's heads. | Domed/scalloped bell, sparse ribs, long independent hanging strips, central pole. |
| Moon and star | Tops around 2.8-3.3 m; lanterns about 0.5-0.8 m across. | Mottled warm globe versus a shallow five-point star, each visibly attached to a pole and carried by a person. |

## Code Boundaries

Verified by source inspection at the baseline, not by a visual or performance run:

| Seam | Current behavior and instruction |
|---|---|
| `src/models/puppet.js:7-151` | One generic builder, random streamer details and phase, and a wall-clock bob that relies on `children[0]`. Replace the puppet-specific portion with named subjects and explicit rig references. |
| `src/models/puppet.js:154-263` | Also exports the pooled `buildSimpleNPC` used by other models. Preserve its existing signature, poses, and default behavior. If carriers need exposed arm/leg pivots, add them without changing existing poses or extracting every consumer to a new module. |
| `src/obstacles.js:104-208` | `PuppetParade` owns six roots, path distance, root position/yaw, honk offset, and colliders. It currently uses 4.5 m spacing and 2.4 m/s speed. Keep this controller rather than building a second parade system. |
| `src/obstacles.js:62-98,177-179` | The loop is a persistent roaming encounter that relocates when the player is far away; it is not chunk-owned. Preserve relocation and the absence of `chunkKey`. Model determinism must not turn into a worldgen or mobile-encounter seeding rewrite. |
| `src/obstacles.js:49-59,159-195` | Lake avoidance adjusts route vertices, and scatter adds its own offset. This is not proof that the entire swept path is dry. Compare any route defect against baseline and report it separately rather than claiming new routing guarantees. |
| `src/main.js:1084-1089` | Calls `puppets.update(dt, zerble.position)`. Keep the main-loop integration small; the puppet ticker can read the existing `getTimeOfDay().nightness` rather than adding another lighting system. |
| `src/main.js:1712-1761` | Collision is XZ circle overlap and returns after one contact. Preserve `kind: 'puppet'`, damage 8, existing bounce/toast/SFX and scoring policy. Overhead geometry must not become one enormous ground-level blocking circle. |
| `sandbox.html:1445-1468` | `puppet` currently chooses a random seed; `puppet_lineup` shows only three models. Both call the production model ticker, but neither exercises `PuppetParade`. Extend these surfaces before making the new models. |
| `sandbox.html:584-652` | The sandbox renderer is not the game's compositor: it has its own shadows and no bloom/fog treatment. A sandbox pass does not prove game-tier correctness. |
| `src/threeShim.js:25-65` | Standard becomes Lambert on Low. Use supported color/emissive properties; keep the shim unchanged. |
| `bin/test-frisbee-player:1-50` | Existing Node structural-test pattern. Its Three stub is not evidence of correct real geometry, lighting, or world transforms. Add browser assertions for those. |

Suggested organization: keep `puppet.js` as the public facade and home of `buildSimpleNPC`; place the new lantern shell/rig builders in one focused `src/models/paradeLanterns.js` if the six subjects would obscure that shared NPC code. Assemble carriers in the facade so that the new module does not import back from `puppet.js`. Avoid one framework or one file per primitive. A private shell/rib construction helper is worthwhile only where at least two subjects actually share the geometry operation.

Use an explicit named roster and `buildPuppet(kind, seed)` at all in-repo callers rather than interpreting arbitrary numeric hues as species. Keep the shipped sandbox keys `puppet` and `puppet_lineup`; make `puppet` select the heron and add named subject entries. There is no need for a numeric-builder compatibility layer after updating its callers.

New modules require importmap/cache-buster coverage. Follow `AGENTS.md`'s all-four-page instruction and run `bin/check-importmaps`; note that the checker currently enforces models in the three full 3D pages but only worldgen/rng in the map page (`bin/check-importmaps:9-13,32-37`). A green check alone does not prove all-four-page coverage.

## Construction Direction

### Paper and Framework

Start with opaque, matte, lightly irregular shells using Standard through the shim, zero metalness, high roughness, and controlled emissive intensity. This is an economical visual approximation of backlit paper, not an optical simulation. Use restrained vertex-color variation or one small seeded procedural paper texture only if the plain shell looks too sterile. A textured version needs explicit texture ownership and disposal.

Use **designed transverse ribs and a few longitudinal spars**, not a triangle wireframe. Generate shell sections and frame curves from the same shape coordinates so their silhouettes align. For the heron neck and seahorse tail, a tapered section sweep along a short authored curve gives more control than stacking spheres or equal-radius tubes. Put visible frame lines just outside the opaque shell to suggest the internal frame without z-fighting; this is an intentional rendering approximation.

Use thin low-sided tube geometry for important ribs, combined per material and animated part, rather than hundreds of separate meshes or dependence on WebGL line width. Keep rib spacing irregular but intentional. Preserve the dark frame against the illuminated paper at Midnight. Folded wings need taper and overlapping edges; the dragon's wings need shallow cloth panels between spars, not solid paddles.

Lantern shell brightness rises smoothly with `nightness`, while the ribs, carrier clothes, and support poles remain dark and scene-lit. Reserve brighter small points for a sparse set of LED-like accents. Keep the heron and seahorse pale lavender/ivory, dragon orange-red with a warmer belly, jellyfish cool ivory, and community lanterns warm amber. No strobing or synchronized color cycling.

No new real lights, transmission, post-processing passes, or dependence on bloom. The lantern must read at Midnight with bloom absent, and retain paper color, frame contrast, and face detail when the game's bloom is enabled. Pooling materials does not batch mesh draws; instance repeated accents or combine static pieces when measurement supports it.

### Carriers and Motion

The controller owns world translation, heading, distance, and scatter. The visual ticker owns child pivots only. Store explicit references under `userData` or an equivalent rig object; never infer the body from a child index. Keep authored rest transforms and calculate motion from them, avoiding cumulative rotation drift.

Advance a model-local clock with `dt`, with deterministic seed-derived phase offsets. Give the sandbox a pause/time scrub that drives the same pose evaluation as normal ticking; a separate screenshot-only animation is not acceptable. Preserve phase continuity through noon, dusk, and night without rebuilding geometry or materials.

Animate **carried weight**, not flight: a small walking rise/fall and roll, a slower head nod, slight wing or tail lag, and trailing jellyfish ribbons. Begin around 0.04-0.10 m vertical motion and a few degrees of rotation, then tune from clips. These are proposed starting amplitudes, not observed real motion. Keep the shell recognizable throughout the cycle.

Carrier hands must visibly meet the poles, and poles must meet attachment points on the shell at all tested poses. Use a shared carrier/pole pivot or update a pole between explicit endpoints using reusable vectors; do not bob the shell away from a stationary pole. Exposed arm/leg pivots may support simple gait, but keep hand constraints intact. The heron's thin puppet legs are distinct from the human operator's legs.

The dragon is one coherent parade unit with three carriers, not three independently scattering creatures. Start with a mostly rigid central frame and gentle head/wing/tail child motion, which matches the visible supported object without assuming a jointed real-world skeleton. All carriers turn and dodge with their unit. Avoid a full skeletal rig, cloth solver, or inverse-kinematics system.

### Spacing and Collision

Keep 4.5 m as the starting separation for ordinary units and give the dragon longer adjacent gaps based on its measured fore/aft envelope, initially about 7 m. Use cumulative roster distances and check clearance across the path wrap; keep the procession clustered rather than distributing its six members evenly around the whole loop. Verify corners, wraparound, and maximum scatter offsets in a moving composite before settling those numbers.

Retain the ordinary unit's radius-1.4 root collider. The dragon's carrier team may extend beyond that footprint: keep the center collider and add small ground circles at the front/rear carriers if needed, all with the same puppet kind/damage. Store explicit collider-to-unit/attachment associations instead of relying on `colliders[i] === puppets[i]`. Update their world positions after root movement, yaw, and scatter. Do not add duplicate colliders through the registry.

The acceptance rule is that no visible ground-level carrier is unprotected, while a broad wing above cart height does not create an invisible wall. Record the final circles and top-down overlay. This is a deliberate footprint refinement, not a new collision engine; exercise ordinary and dragon contacts through the real game resolver.

## Implementation Checklist

### Checkpoint 1: Baseline and Harness

- [x] Read `AGENTS.md`, local overrides if present, `DEBUGGING.md`, `.claude/rules/sandbox-and-testing.md`, and `.claude/rules/performance.md`. Load the relevant Three geometry/material/animation skills. Verify the current branch and preserve unrelated work.
- [ ] Obtain the five photo attachments for direct comparison and record their location/provenance above. If unavailable, report that limitation; do not claim photo-matched approval from text alone.
- [ ] Run the existing check suite and capture the old `puppet` and `puppet_lineup` at Noon and Midnight. Record the git ref, camera, viewport, tier, geometry/texture counts, and draw/triangle counts before replacement. The old random visuals make the screenshots, not the seed alone, the baseline.
- [x] Make the current single-puppet preview deterministic before replacing its appearance. Add a time pause/scrub, a human-scale ruler or ordinary NPC comparison, and a reproducible close-up plus game-distance camera. Keep the controls scoped to puppet views.
- [ ] Extend the existing lineup to use the complete production roster and one owned scene root. Capture all six OLD puppets here before replacement so later full-roster measurements are six-versus-six, not six-versus-three. Add a moving `puppet_parade` composite that runs the production controller with an explicitly fixed preview path/anchor and no recycling, through a small constructor option rather than a copied path implementation or monkey-patched global randomness. Ensure switching views disposes owned resources and removes controls/updaters. The fixed production-controller preview and cleanup are implemented; baseline six-puppet captures were missed and are not claimed.

**Exit condition:** refreshing the same URL produces the same subject and held pose; the real controller can be previewed without navigating the festival. Save the reproducible URLs and API/control instructions in `DEBUGGING.md`.

### Checkpoint 2: Heron Direction Review

- [x] Implement the named heron, explicit rig references, deterministic detail/phase, and production ticker, while preserving the shared NPC helper's default behavior. The other roster slots may remain clearly labeled placeholders during this checkpoint.
- [ ] Iterate in this order: silhouette and proportions, operator/pole attachment, paper/frame contrast, then motion. Compare side and three-quarter views directly with Photo 1; correct one category at a time.
- [ ] Save Noon and Midnight views both close and roughly 15-25 m away, including Low tier. Capture a short motion clip or a labeled pose sequence spanning a complete gait cycle; a still cannot establish that the pole stays attached.
- [ ] Boot the main game, start gameplay, inspect console/shader errors, and verify other `buildSimpleNPC` users still render correctly if that helper changed. Main game booted and rendered on Low; in-app browser exposes no console, so error inspection remains unverified.
- [ ] Send the review packet to Gary/Astra and stop before building the remaining subjects. Record the verdict and requested corrections here.

**Exit condition:** Astra/Gary approves the heron's silhouette, material treatment, supported motion, and game-distance readability. A technically passing render is not visual approval.

### Checkpoint 3: Complete Roster

- [ ] Build the dragon against Photo 5, including three carriers, real supports, warm belly, broad thin wings, ridged back, and tapering curl. Inspect from both sides so the body is not a flat billboard.
- [ ] Build the seahorse against Photo 4, preserving the snout and open tail curl; build the jellyfish against Photo 5 with sparse hanging ribbons and steady light accents.
- [ ] Build the moon and star carriers using the same materials/rig conventions at the smaller community scale. Keep their silhouettes distinct from one another and the giant subjects.
- [ ] Add deep links/dropdown entries `puppet_heron`, `puppet_dragon`, `puppet_seahorse`, `puppet_jellyfish`, `puppet_moon`, and `puppet_star`, all running production constructors/tickers. Wire every applicable entry to the existing puppet "Hit it" SFX.
- [ ] Capture each subject at Noon/Midnight, then the full lineup at human eye level and cart-camera distance. Tune shared material treatment without flattening the roster into one color or silhouette.

**Exit condition:** all six subjects are independently recognizable, properly carried, and reproducible through their own sandbox URLs on Low, Mid, and High.

### Checkpoint 4: Integration and Regression Tests

- [ ] Install the named roster, cumulative spacing, and explicit collider attachments in `PuppetParade`; preserve speed, root-yaw convention, relocation, scatter timing, and scoring/SFX kind. Exercise at least one complete route lap, every corner, wraparound, and a parked honk in the moving composite.
- [ ] Add focused `bin/test-puppet-parade` coverage and wire it into `npm run check`. Cover roster identity, same-seed geometry/detail parameters, finite poses, `dt=0`, deterministic time samples, ticker preservation of root transforms, stable resource counts through repeated ticks, and unchanged default NPC poses. Test controller spacing and collider associations with a fixed preview route.
- [ ] Use real Three in the browser to assert geometry bounds, pole endpoints, carrier/collider alignment through yaw/scatter, and stable resource counts after at least five sandbox switch/rebuild cycles following warm-up. Do not teach the Node stub fake geometry math just to turn tests green.
- [ ] Smoke-test the main game on Low, Mid, and High: title card, real Start tap, advancing world, and no uncaught module/shader errors. Check both Noon and Midnight, plus the dusk transition. Test a narrow/mobile viewport as well as desktop.
- [ ] Locate the live parade through `__dbg.game.puppets`, use `__dbg.teleport` and `camLock`, and verify actual puppet collisions, hit feedback, a parked honk, and distant loop relocation. Record the live route/anchor as well as seed: mobile encounter placement is intentionally random. `freezeNPCs(true)` freezes crowd AI, not the parade; use global pause/step for stills.
- [ ] Confirm the same six model roots and finite collider positions survive relocation without duplicate scene objects, colliders, or newly allocated model resources. Compare collision behavior in Just Cruisin' and Festival Run without altering their rules.

**Exit condition:** the complete procession works through the production path, not just an isolated model view, with focused tests and browser evidence for the transform-dependent behavior.

### Checkpoint 5: Performance and Final Handoff

- [ ] Measure the full new roster against the old baseline with matching camera, tier, time of day, viewport, pixel ratio, and render-quality settings. Record model-only draws/tris and resource counts separately from full-game frame timing. Use a real GPU browser for timing, not SwiftShader FPS.
- [ ] Treat no additional lights/passes and bounded resource lifetime as hard gates. Start with a provisional goal of no draw-count increase for the full roster and no repeatable Low-tier frame-time regression; this is a proposed acceptance target, not a measured budget. If fidelity needs a measured increase, present the delta and get approval rather than silently deleting subjects or claiming the HUD's budget colors prove success (`.claude/rules/performance.md:45-51`).
- [ ] Tag bounded, reusable geometry/material/texture pools as shared; dispose per-preview resources exactly once. Keep animation allocation-free for geometry/materials, and avoid rebuilding curves or textures each frame. Verify new shadow casters respect the existing policy.
- [ ] Run `npm run check` and `bin/check-importmaps`, recording exact failures separately from pre-existing baseline failures. Document new sandbox/debug controls and the final model/animation contract in `DEBUGGING.md` and the relevant architecture section.
- [ ] Prepare the final review packet below and request Astra's review. Update this plan's checkbox state and unresolved findings. Implementation is ready for review, not automatically approved for deployment.
- [ ] After final approval, update `CHANGELOG.md` under the actual shipping date and trim the linked Roadmap bullet when shipping. Commit or deploy only when Gary requests it.

**Exit condition:** evidence is complete, limits are explicit, and the remaining action is an informed visual/code review rather than asking Gary to hunt for the parade.

## Review Packet

Use `verification/puppet-parade/README.md` as the eventual evidence index; do not create empty success artifacts now. Include:

- The baseline ref, implementation ref or uncommitted diff scope, checked tasks, and any deviations from this plan with reasons.
- Exact URLs, subject seeds, animation time, camera poses, viewport, tier, ToD, and effective quality settings for reproducing each capture. Mark proposed controls as implemented only after they exist.
- Before/after contact sheets, the six Noon/Midnight subject pairs, full-procession images, a heron/dragon close-up, and the motion clip or labeled sequence. Add a Low-tier no-bloom view and a real-game bloom view.
- A compact comparison of reference feature versus result for each subject: silhouette, frame/paper, operator/support, and motion. Link each judgment to an image rather than writing only "looks good."
- Test commands/results, console logs, actual game collision/scatter/relocation evidence, resource-lifecycle samples, and matched before/after performance measurements. Separate visual proof from timing proof and simulated viewport coverage from physical-device testing.
- A short unresolved-findings list, or an explicit statement that none remain. Never call absent browser/device evidence a pass.

**Astra's review priorities:** first reject incorrect silhouettes and disconnected operators, then check silhouette/material behavior at gameplay distance, then collision/transform/lifecycle regressions and Low-tier cost. Polish tiny paper wrinkles only after those pass.

## Agent Prompts

### First Implementation Session

> Read `PUPPET-PARADE-PLAN.md` and implement only Checkpoints 1 and 2: the reproducible sandbox harness and the heron direction proof. Use the five reference photos from Gary's planning conversation; report if you cannot access them. Preserve `buildSimpleNPC` consumers and the existing parade's gameplay policy, and make manual edits with apply_patch. Iterate by actually inspecting Noon/Midnight renders and motion, then smoke-test the real game. Save evidence under `verification/puppet-parade/`, update the checklist, and stop for Astra/Gary's heron review before building the rest. Do not commit or deploy.

### After Heron Approval

> Read the approved heron review and `PUPPET-PARADE-PLAN.md`, then carry out Checkpoints 3 through 5 through final-review readiness. Complete all six subjects, production integration, regression tests, and the review packet. Keep the harness on the same constructors/tickers/controller as the game. Record measured tradeoffs and any unavailable verification honestly; request approval for scope or performance-target changes. Do not commit or deploy.

### Review Request

> Astra: review the implementation against `PUPPET-PARADE-PLAN.md`, the supplied reference photos, and `verification/puppet-parade/README.md`. Inspect the actual diff and renders, prioritize visual fidelity and gameplay regressions, and distinguish must-fix findings from optional polish. Provide specific corrections for the implementation agent; do not infer successful verification from its summary alone.
