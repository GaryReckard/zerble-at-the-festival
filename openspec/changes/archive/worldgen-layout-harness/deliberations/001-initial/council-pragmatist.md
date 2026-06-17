# Council — The Pragmatist (Force Multiplier)

## The Pragmatist's Position

### Critical Path

The thing this change exists for is `festival-zone-grammar` (ROADMAP:73-98:
"Depends on the layout harness below — the linter is the verification gate").
So the true critical path is the **grammar-unblock chain**, and it is shorter
than the 8-group task list implies:

```
(v2 change: H.2 road-existence fix — see Finding 1)
  → 1.1 dumpRegistry + 1.2 capture script + pre-refactor snapshots
  → Group 2  FESTIVAL_TUNING hoist            (golden-frozen gate)
  → Group 3  dry-run layout extraction        (golden-frozen, 1 builder/commit — the L item)
  → Group 4  linter (+ 4.7 self-check)
  → 8.1      baseline.md
  → ===== festival-zone-grammar can START =====
```

Everything else — gotoHub/topDown/showFootprints (1.3–1.5), the true-extent
overlay + gallery (Group 5), the hub viewer + sliders (Group 6), markers
(Group 7) — is off that chain. Two of them earn early slots anyway
(Findings 4 and 8); the rest is tail work that can overlap grammar planning.

One ordering bug inside the chain: 4.7 as written depends on Group 5
("find one via gallery/overlay") — a forward reference that either stalls the
gate on QoL work or gets skipped. It's resolvable for free (Finding 3).

### Priority Sequence

1. **Land H.2 (v2 change) first, then freeze.** The harness is golden-frozen
   end to end; H.2 deliberately MOVES the queryPoint golden. Get the golden
   settled before capturing the snapshots everything gates on.
2. **Build the instrument as a one-command script** (1.1 + 1.2), not a jq
   ritual — it runs ~20 times during Group 3.
3. **Run the two golden-frozen refactors back-to-back** (Groups 2 → 3) while
   the world is frozen — the longer the freeze window stays open, the more
   chances Gary's live tuning of `constants.js` invalidates snapshots.
4. **Promote 5.1 (true-extent overlay) to immediately after Group 3** — it's
   the only *visual* verifier of the headless layouts path the linter will
   trust (Finding 4).
5. **Linter + baseline** (Group 4 + 8.1) — grammar is unblocked here. Get
   Gary's eyes on the rule table async while building (Finding 10).
6. **Hub viewer next, not last** (Group 6) — Gary judges in 3D; grammar
   iteration with him needs this surface on day one of the grammar change
   (Finding 8).
7. **Gallery, markers, doc sweep** (5.3/5.4, 7, 8.2/8.3) — true tail; can
   land while grammar planning is underway.

### Findings

1. **[HIGH] H.2 (v2 change) must land BEFORE snapshot capture (task 1.2), or
   after this whole change — never mid-stream.**
   *Evidence:* `v2-worldgen-3d-integration/HANDOFF.md` ("WARNING: it may MOVE
   the `queryPoint` golden `63c8dea2`… re-record the golden after"); this
   change's design Migration Plan ("no 'accept the drift' option exists in
   this change"); tasks.md header gates every Group 2–3 commit on "both
   goldens unchanged" + empty snapshot diff. Road *existence* changes
   `noBuild` → festival placement → every layout snapshot. If H.2 lands
   mid-harness, all captured snapshots and both goldens shift and the gate
   machinery reports false failures on a correct refactor.
   *Recommendation:* sequence H.2 (small, flagged "fresh context" in the
   HANDOFF) as commit zero; re-record goldens; THEN run 1.2. This also gives
   the linter's road-corridor rules (booth-on-road, truck-off-road) a stable
   road set to assert against. H.3/F.5 (real-device budget) is orthogonal —
   no shared code, schedule whenever Gary's hardware is available.

2. **[HIGH] Do NOT split into two OpenSpec changes; DO declare the
   grammar-unblock milestone inside this one.**
   *Evidence:* every group is independently committable (tasks.md header);
   repo convention is bootable checkpoint commits with CHANGELOG in the same
   commit (changelog-and-roadmap.md), so a split buys no delivery safety —
   it only doubles OpenSpec overhead (README/session-log/deliberation gate
   ×2) and invites the QoL half to rot un-applied.
   *Recommendation:* one change, but move 8.1 (baseline) up to immediately
   after Group 4 and mark it in tasks.md as the explicit milestone:
   "festival-zone-grammar may start here." Groups 5.3/5.4, 6, 7 then ship as
   in-change fast-follows, overlapping grammar planning.

3. **[MEDIUM] Task 4.7 has an ordering conflict — it references Group 5
   surfaces ("find one via gallery/overlay") that come after it.**
   *Evidence:* tasks.md 4.7 vs. group numbering; but a known-bad seed is
   already documented — playtest round 2 ran seed `0xf7ef2a3c` (commit
   `d8b8a4c`, "trucks clipping vendor rows" per proposal/ROADMAP), and round-1
   notes live in `festival-polish-backlog.md`.
   *Recommendation:* pin 4.7 to seed `0xf7ef2a3c` (+ the round-2 notes'
   locations) instead of "find one." With Finding 4's reorder, the overlay
   exists by then anyway as a second way to spot one. Zero new work either way.

4. **[MEDIUM] 5.1 (true-extent overlay) is a force multiplier — pull it
   forward to right after Group 3.**
   *Evidence:* the D-A snapshot diff proves the *game path* (chunks.js →
   registry) is unchanged; it proves nothing about the *headless* path
   (layouts.js called with worldgen `lakeAt` instead of `isPointInLake`,
   design D-C) — which is exactly the path the linter consumes. The overlay
   is the cheapest eyes-on check that headless records match the world,
   before the linter builds its credibility on them. It's also cheap:
   map-sandbox already has the layer-toggle + inspector conventions
   (proposal Scope Check), and it depends only on layouts.js, not the linter.
   *Recommendation:* land 5.1 (+5.2 hover, trivially) between Groups 3 and 4.
   5.3/5.4 (gallery) stay in the tail.

5. **[MEDIUM] The importmap maintenance actually spans FOUR html files, not
   the three the artifacts count.**
   *Evidence:* tasks 3.1/4.1 say "importmap in BOTH html files"
   (index + sandbox); but `map-sandbox.html:28` carries its own worldgen mods
   cache-buster array, and Group 5 makes map-sandbox import `layouts.js`
   (5.1) and `lint.js` (5.4). Miss it and overlay edits silently stop
   reloading on local dev — the repo's most-tripped footgun.
   *Recommendation:* amend tasks 3.1/4.1/5.1 to name `map-sandbox.html`
   explicitly, and write the no-build.md note (task 6.4) as "every consuming
   html file" with the four enumerated, not "three."

6. **[MEDIUM] Make 1.2 a real one-command script — the snapshot ritual is the
   hidden tax on Group 3's one-builder-per-commit discipline.**
   *Evidence:* tasks.md 1.2 offers "a tiny script or documented jq one-liner."
   Group 3 is ~8 gated commits × 3 seeds × before/after = ~50 capture+diff
   operations, each requiring a live boot via the preview MCP. Also
   `constants.js` holds Gary's experimental dense tuning (HANDOFF) — if he
   re-tunes mid-harness, every snapshot invalidates and must be recaptured.
   *Recommendation:* a checked-in capture script (boot → `__dbg.start()` →
   `dumpRegistry()` → normalize → write `verification/snapshots/<seed>.json`,
   plus a `diff` mode) so a full re-baseline costs minutes. Secondary: agree
   with Gary to freeze worldgen tuning for the Group 2–3 window.

7. **[MEDIUM] Flag-flip sequencing: I.0 (`DEFAULT_WORLDGEN_V2=true`) belongs
   AFTER `festival-zone-grammar`, not before or during this harness.**
   *Evidence:* HANDOFF still lists "Group I — landing" as next-priority #2,
   but that ordering predates the playtest verdict ("the festival ARRANGEMENT
   is the real problem"). The deploy is observed by real players (CLAUDE.md);
   flipping the default now ships the jumble.
   *Recommendation:* re-sequence the v2 change's remaining work to
   H.2 (now) → harness (this change) → grammar → H.3/F.5 + I landing
   (flip + ARCHITECTURE rewrite + ROADMAP trim). Note it in the v2 HANDOFF so
   a fresh session doesn't execute the stale order.

8. **[LOW] The hub viewer is off the linter-gate path but ON the grammar
   critical path — schedule it as the first post-gate item, not the tail.**
   *Evidence:* ROADMAP:119-122 ("Where grammar iteration and Gary-facing 3D
   screenshots happen"); grammar is "done TOGETHER with Gary" (HANDOFF), and
   the standing project memory is that Gary judges festival work in 3D
   screenshots, not 2D overlays. The TUNING sliders (6.3) are also the
   instant-feedback loop the grammar tuning needs.
   *Recommendation:* Group 6 lands immediately after 8.1, before gallery and
   markers — ideally before the grammar change's first build commit.

9. **[LOW] Group 1 mixes the gate instrument with QoL verbs.**
   *Evidence:* only 1.1/1.2 gate anything; 1.3 `gotoHub` and 1.4 `topDown`
   are S-sized reuse of existing plumbing (`teleport` main.js:1391, `camLock`
   main.js:1328, `heartsInBounds`); 1.5 `showFootprints` is the only one with
   real risk surface (disposal) and gates nothing.
   *Recommendation:* commit 1.1+1.2 first and alone; 1.3/1.4 ride a second
   cheap commit (they make Group 3's verification screenshots easier, so
   they're worth having early); 1.5 can slide as late as Group 6 with zero
   downstream cost.

10. **[LOW] Grammar planning can and should overlap the harness build.**
    *Evidence:* ROADMAP:108-113 — "the assertions ARE the spec." The Group 4
    rule table (D-D) is the executable skeleton of Gary's festival grammar;
    writing it IS grammar design work.
    *Recommendation:* when the rule table drafts (4.1), drop it into
    `questions-for-human.md` for Gary's review — his sign-off on the rules
    doubles as the grammar change's requirements review, bought for free
    during harness build. The `festival-zone-grammar` proposal/design can be
    drafted any time after Group 4 starts; only its APPLY waits on 8.1.

11. **[LOW] 8.2's single end-of-change CHANGELOG entry conflicts with the
    repo's same-commit rule.**
    *Evidence:* changelog-and-roadmap.md — "Don't batch changelog updates
    across multiple commits"; dev-workflow changes require entries.
    *Recommendation:* each landed surface (dbg verbs, linter CLI, overlay,
    hub viewer, markers) carries its CHANGELOG line in its own commit; 8.2
    becomes the ROADMAP "Layout-work agent harness" trim sweep + any
    consolidation, not the first entry.

### Effort Reality Check (per group)

| Group | Size | Where the surprises hide |
|---|---|---|
| 1 (instrument) | S–M | 1.5's dispose walk; everything else is reuse of existing `__dbg` plumbing |
| 2 (hoist) | **M, not S** | 34 constants across 2,608-line chunks.js + festival.js; near-duplicate constants used by planner AND builder under different names — the temptation to *unify* them is the scope-creep trap (unifying = behavior change = snapshot diff failure). Inventory 2.1 must mark "same number, two owners, do NOT merge yet" |
| 3 (dry-run) | **L — the bulk of the change** | ~9 builders with rng interleaved into mesh code; conditional draws (water rejects); cosmetic draws buried in nested helpers (`placePolePair`, model-level rolls); any model function that itself takes rng blurs the split boundary. The per-commit gate ritual ×8 is why Finding 6 matters |
| 4 (linter) | M | Road-corridor geometry for `booth-on-road`/`spawn-arrival`; the rest of the rules are S each once context assembly exists |
| 5 (surfaces) | S (5.1/5.2) + M (5.3 gallery) | Gallery's render-once/yield loop; everything else extends existing map-sandbox conventions |
| 6 (hub viewer) | M–L | `buildHubPreview`'s synthetic ctx is the R2 return-shape class on a new surface (design acknowledges this); the slider panel itself is S given map-sandbox `setConfig` (map-sandbox.html:577) — but tuning.js must be authored mutable-CONFIG-style from Group 2 or it gets rewired twice |
| 7 (markers) | S | Key-map collision check only |
| 8 (close) | S | — |

One Group-2 prerequisite worth pulling forward: since 6.3 binds sliders to
tuning.js "the same way map-sandbox's `setConfig` works," **author tuning.js
with the mutable-CONFIG + setter shape in Group 2**, not as frozen consts to
retrofit in Group 6.

### Reuse Audit

Already-existing surface the plan correctly leans on (nothing major is being
rebuilt): map-sandbox TUNING·LIVE + `setConfig` (map-sandbox.html:98,577) for
6.3; the selftest node-CLI invocation style for 4.5; `camLock`/`teleport`
(main.js:1328/1391) for 1.3/1.4 — and D-F's perspective-top-down-instead-of-
ortho is the right cheap call; the gallery reuses the map-sandbox draw routine
(no node-canvas dependency); the hub viewer goes through the real
`buildWorldgenKind` (chunks.js:1159) rather than a parallel path. The only
"rebuild" smell is the manual snapshot ritual — fixed by Finding 6.

### Deferred / Park on ROADMAP

Nothing needs to leave the change, but three items are explicitly NOT on any
blocking path and should be last (or overlap grammar planning):

- **5.3/5.4 seed gallery**: distribution-tail detection matters most when
  *judging the grammar's output* — i.e., during/after the grammar change.
  Nothing in this change or the grammar's start is blocked by deferring it.
- **Group 7 playtest markers**: pays off at the NEXT Gary playtest, which
  happens after grammar round 1. Must exist *by then*; blocks nothing before.
- **1.5 showFootprints**: useful during grammar iteration; gates nothing here.
- Already correctly parked by the design (keep them parked): true ortho
  camera, CI plumbing, fixing any violation the linter finds.

### Incremental Delivery Plan

- **Slice 0 — settle the ground (v2 change, fresh context):** H.2 tie-break
  → integer test, re-record queryPoint golden, node==browser re-verify.
  Enables: a stable golden + road set to freeze against. Verify: selftest
  green, boot both flag states.
- **Slice 1 — the instrument (commits 1–2):** 1.1 dumpRegistry + 1.2 capture
  *script* + pre-refactor snapshots at {1234, 0xf7ef2a3c, +1 fresh}; then
  1.3 gotoHub + 1.4 topDown; DEBUGGING.md each commit. Verify: snapshot
  diff of two captures at the same seed is empty (the instrument's own test).
- **Slice 2 — the golden-frozen refactors (commits 3–11):** Group 2 hoist
  (tuning.js authored mutable-CONFIG-style; importmaps in index + sandbox);
  then Group 3, one builder per commit, each gated by script-diff + goldens +
  dual-flag boot; 3.6 zero-rng grep closes it. Verify: per-commit gate; this
  is the freeze window — keep it short, no tuning changes inside it.
- **Slice 3 — eyes on the headless path (commit 12):** 5.1 true-extent layer
  (+5.2), map-sandbox importmap entry. Verify: overlay over seed 0xf7ef2a3c
  shows the known truck/booth clipping in 2D.
- **Slice 4 — the gate itself (commits 13–16):** Group 4 linter (4.7 pinned
  to 0xf7ef2a3c) + 8.1 baseline.md. **Grammar-unblock milestone.** Gary
  reviews the rule table async (-> questions-for-human). Verify: CLI run
  across ≥10 seeds; the known-bad seed fires `overlap`.
- **Slice 5 — the grammar iteration surface (commits 17–18):** Group 6 hub
  viewer + buildHubPreview + 6.3 sliders + 1.5 showFootprints + the
  four-file importmap doc update (6.4). Verify: Noon + Midnight screenshots
  of one hub; then boot the REAL game both flag states.
- **Slice 6 — tail, may overlap grammar planning (commits 19–21):**
  5.3/5.4 gallery (+ lint counts), Group 7 markers, 8.2 ROADMAP trim sweep +
  8.3 final smoke (`?perf=low`, budget panel unchanged). CHANGELOG entries
  travel per-commit throughout, per Finding 11.

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: Sequencing with the active v2 change — H.2 moves the
  golden this entire change freezes against; landing it mid-harness corrupts
  the gate machinery, and the HANDOFF's stale "I landing next" order would
  ship the jumbled festival to real players if executed as written.
- **Recommendation**: One change, re-ordered: H.2 first, then
  instrument → hoist → dry-run → overlay → linter → baseline as the declared
  grammar-unblock milestone (~16 commits), hub viewer immediately after,
  gallery/markers as tail overlapping grammar planning. Fix the 4.7 forward
  reference (pin to seed 0xf7ef2a3c), script the snapshot capture, name all
  four importmap-bearing html files, and author tuning.js slider-ready in
  Group 2 so Group 6 doesn't rewire it.
