# Festival layout research against the current generator

October 24, 2026. Source review and a targeted placement correction during concurrent terrain integration; no new visual playtest or claim of research-source revalidation. The original research is archived under `openspec/changes/archive/2026-06-21-festival-zone-grammar/research/`.

**TL;DR:** Keep the district grammar, but do not equate preserving today's coordinates with producing the best festival. The strongest immediate improvements are to close the surviving drum-placement validation hole and make terrain respect complete approach routes and recognizable arrival views. Curved markets deserve a focused composition improvement rather than another density increase.

## 1. Keep the existing district structure and household camps

**Verified:** The planner reserves stage/audience space, puts markets on approach roads and food courts off their sides (`src/worldgen/festival.js:976`, `:997`, `:1013`). It classifies cross-hub fronts into merged courts, shared streets, yielding or soft buffers (`:384`), and attaches welfare bundles (`:1072`). Recent camps have one host hearth/kitchen, compact sleeping satellites and explicit approaches instead of repeated independent mini-camps (`src/campPlanning.js:41`, `:59`, `:94`); woodland builders retain paths and actual residents (`src/chunks.js:1923`, `:1928`).

**Judgment:** This is a good fit for the research's “legible districts” and low-intensity living neighborhoods, not evidence for replacing the generator wholesale (archived `festival-layout-chatgpt-round3-deep-research.md:5`, `:40`). Preserve these relationships through terrain. More uniformly scattered assets would weaken them.

## 2. Validate the final drum position after relocation

**Verified defect:** The drum search receives a cluster-clearance rejection callback (`src/worldgen/festival.js:1067`) and applies it to original candidates (`:674`), but road/water nudging can relocate an accepted candidate (`:695`). Before this correction, the helper rechecked only tree density before returning the final position. The linter separately rejects drum centers inside another cluster (`src/worldgen/lint.js:247`).

**Implemented:** The final position now passes the same caller-supplied envelope rejection (`src/worldgen/festival.js:706`). An invalid relocated candidate is omitted, consistent with the existing density/nudge failure behavior, and the helper adds no RNG draws. An omitted drum skips its later yaw draw, so downstream descriptors can intentionally change for affected hubs (`src/worldgen/festival.js:1069`). This directly supports the archived research's wooded-room rule (`openspec/changes/archive/2026-06-21-festival-zone-grammar/research/festival-layout-chatgpt-round3-deep-research.md:26`).

**Regression evidence:** `node bin/test-festival-terrain-layout` executes the actual private helper with controlled landscape queries. A valid wooded original candidate is moved to `(999,888)`, where the caller rejects it. The unpatched helper incorrectly returned this location; the corrected helper returns `null`. The test also checks valid relocated candidates, bare/null final spots, two draws for an accepted original candidate, and the bounded 24 draws when all twelve original candidates fail. This is a controlled helper regression, not a naturally generated seed reproduction.

**Historical correction:** The June seed-256 drum-inside-court report in `docs/backlog/festival-layout.md` does **not** reproduce in today's generator. The new test scans its ±2 km window and confirms zero `drum-in-trees` findings; the remaining findings are 15 `stage-spacing` warnings. Do not use those historical coordinates as current failure evidence.

## 3. Grade access corridors, not only occupied pads

**Verified:** Household plans publish two-meter access corridors (`src/campPlanning.js:94`), woodland districts render paths (`src/chunks.js:1923`), and drum paths connect to nearby roads (`:2451`). Arterials remain the primary road network (`src/worldgen/roads.js:1–9`). The research explicitly calls for formal connections through the quieter territory (archived round-three research, `:24`, `:42`).

**Recommendation now:** Include these existing path extents and welfare approaches in terrain grade/clearance fixtures. A level camp whose connecting path crosses a steep shoulder fails the intended neighborhood experience. This improves accessibility without moving existing horizontal anchors or consuming layout RNG; new connector topology is unnecessary until actual missing links are measured.

## 4. Replace accidental market gaps with deliberate frontage

**Verified:** Vendor rows are straight, and the builder skips booths where curved roads intersect the row (`src/chunks.js:1671–1677`). This protects circulation but does not produce continuous frontage; the research prioritizes market-row continuity (archived round-three research, `:34`, `:50`).

**Recommendation:** Make a bounded curve-following row experiment in the real hub viewer, preserving descriptor identity and per-slot seeds while comparing clearance and browse continuity. This is a feasible next composition improvement alongside terrain, but its acceptance must include reserved camper bands and neighboring frontage, not just attractive booth positions. Expect intentional built-layout differences even if descriptor goldens remain stable.

## 5. Test arrival identity through the new hills

**Verified:** Non-spawn arches are deliberately sparse, with 25% eligibility among majors (`src/worldgen/tuning.js:151`), while the research calls for distant and local landmarks (`archived round-three research:23`). Arch placement establishes a road threshold (`src/worldgen/festival.js:1133`), but does not establish visibility over terrain.

**Recommendation now:** Compare approaching and returning to several major hubs from both sides of a crest. Preserve sight corridors or distinctive stage silhouettes through terrain shaping before adding more arches. Whether hubs feel sufficiently distinct is an experience judgment requiring those captures; source structure alone cannot establish it.

## Verification and boundaries

The targeted placement test passes on Node v24.10.0. `runSelfTest()` before the correction passed determinism, window-invariance and negative-control gates with query hash `eddf8e50` and POI hash `846e1957`; the post-correction run passes the same gates and retains both exact hashes. No golden update is required for this sampled fixture. No layout golden is changed solely because a historic report said there was a failure. The controlled regression proves the missing final validation, while the sampled seeded lint establishes only the current seed-256 window.

The route, market-continuity and arrival-view recommendations above are assessment findings, not claims of implemented or visually accepted behavior. The current terrain descriptors grade venue, camp and lake disks (`src/worldgen/terrain.js:43`, `:70`, `:75`, `:82`), while access routes are not independent grading descriptors in that implementation. The archived research itself distinguishes sourced geometry from experience heuristics (`openspec/changes/archive/2026-06-21-festival-zone-grammar/research/festival-layout-chatgpt-round3-deep-research.md:54`). Hills require new in-game evidence for route feel and sightlines; source review cannot establish either.
