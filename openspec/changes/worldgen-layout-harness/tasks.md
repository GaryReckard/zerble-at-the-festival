# Tasks — worldgen-layout-harness

> Revised after deliberation 001-initial. The dry-run extraction (old group 3)
> is **deferred to festival-zone-grammar** (design D-C′) — the group number is
> retired, not renumbered, so cross-refs stay auditable.
>
> **READ [APPLY-GUARDRAILS.md](APPLY-GUARDRAILS.md) FIRST** — one page: the
> DO-NOT list, the gate ritual, stop conditions, model routing, and verified
> code anchors. Tasks below carry inline anchors (file:line, verified
> 2026-06-10) and a "done =" criterion; if a "done =" can't be demonstrated,
> the task isn't done.

**Sequencing (CG3):** commit zero is the v2 change's H.2 fix (it moves the
queryPoint golden this change freezes against) — land it, re-record, re-verify
node==browser, THEN capture snapshots. During group 2's hoist window: tuning
freeze (-> Q5 agreed — announce open/close to Gary). The **grammar-unblock
milestone** is groups 1 + 2 + 4 + task 8.1; groups 5–7 finish as in-change
fast-follows (hub viewer first — Gary judges in 3D). Golden-frozen commits
(group 2, task 6.1) run the FULL gate ritual from APPLY-GUARDRAILS. CHANGELOG
entries travel per-commit. Capture protocol everywhere:
`?worldgen=1&seed=S&perf=high`, crowd on, no driving (-> Q3 answered).

**Model routing (Gary-approved):** 0.1 → Fable. 6.1/6.2 → Fable or careful
Opus 4.8. 1.x/2.x/4.x → Opus 4.8. 5.x/7.x/8.x/6.3–6.7 → Opus or Sonnet.
`/smart-review` after group 2 and after 8.1.

## 0. Cross-change preconditions

- [x] 0.1 **[Fable]** Land v2 H.2 (cross-engine road-existence integer test —
      the `roads.js:167` detour tie-break; see v2 HANDOFF "Group H") as commit
      zero; re-record queryPoint golden; re-verify node==browser.
      done = selftest passes in node AND a browser with the SAME new golden
      hash; v2 session-log records the old→new hash. *(done 2026-06-10 —
      cross/dot rewrite; goldens HELD eddf8e50/01532955, old==new recorded in
      v2 session-log; node==browser eddf8e50; selftest 23/24 both engines =
      the pre-existing noneBelow=0.05 T5 miss, no new failures)*
- [x] 0.2 After Gary confirms -> Q2: write the corrected order (H.2 → harness →
      festival-zone-grammar → H.3/F.5 + I landing) into the v2 change's
      HANDOFF.md so a fresh session doesn't execute the stale "flip the flag"
      order *(done 2026-06-10, same day as the confirm)*

## 1. The instrument first — capture + `__dbg` layout verbs

- [ ] 1.1 `__dbg.dumpRegistry(bounds?)` in main.js — JSON-able array {kind, x, z,
      footprint, colliderR, damage, attractorR, attractorW, chunkKey} + per-
      cluster draw counts once 1.4 lands. Anchor: `window.__dbg` object at
      [main.js:1307](../../../src/main.js#L1307); register in `help()`
      ([main.js:1409](../../../src/main.js#L1409) block). Registry entries are
      readable via the singleton ([registry.js:143](../../../src/registry.js#L143)
      neighborhood). READ-ONLY — see guardrail #7.
      done = booted game, `JSON.stringify(__dbg.dumpRegistry()).length > 0`,
      includes a known kind (e.g. 'stage'), and a second call returns identical
      output.
- [ ] 1.2 `bin/layout-snapshot <seed> [out.json]` — boot → `__dbg.start()` →
      settle (loaded-chunk count stable for 60 frames, no driving) →
      `dumpRegistry()` → normalize (sort kind+x+z, round 1e-4) → write
      `verification/snapshots/<seed>.json`; plus `--diff a b` + `--seeds` loop.
      Precedent for bin/ scripts: `bin/readme-sync`. Document the copy-paste
      preview-MCP recipe in DEBUGGING.md in the SAME commit.
      done = running it twice for seed 1234 produces two files whose `--diff`
      is empty (this is also task 1.3's control).
- [ ] 1.3 Twice-capture self-diff control: same seed/tier twice → empty
      self-diff REQUIRED before any refactor diff is trusted.
      done = documented empty self-diff for all 3 seeds in `verification/`.
- [ ] 1.4 Draw-count canary: wrap each cluster's rng (`cctx.rng` created in
      `buildWorldgenKind`, [chunks.js:1159](../../../src/chunks.js#L1159)) in a
      counting closure; counts emitted in the dump. MUST NOT change draw order
      (a counter wrapper doesn't draw — keep it that way).
      done = dump shows per-cluster counts; self-diff (1.3) still empty.
- [ ] 1.5 Capture PRE-refactor snapshots at seeds {1234, 0xf7ef2a3c, +1 fresh}:
      spawn ring + one shoreline hub + one dense multi-hub window per seed
      (locate via map-sandbox), + one hub's Noon/Midnight screenshot pair per
      seed (cosmetic catch — registry snapshots don't see colors).
      done = `verification/snapshots/` committed with a manifest listing
      seed/window/tier per file.
- [ ] 1.6 `__dbg.gotoHub(n)` — nth-nearest heart (worldgen `heartsInBounds`)
      teleport + canonical 3/4 camLock facing the stage; prints the equivalent
      hub-sandbox URL. camLock pattern:
      [main.js:1328](../../../src/main.js#L1328).
      done = `gotoHub(0)` at seed 1234 frames the spawn hub's stage in one
      call; screenshot attached.
- [ ] 1.7 `__dbg.topDown(x?, z?, span)` via existing camLock plumbing — camera
      at height `span / (2·tan(fov/2))` looking straight down (design D-F).
      done = `topDown()` over the spawn hub yields a readable plan-view
      screenshot.
- [ ] 1.8 `__dbg.showFootprints(on)` — footprint rings + dancefloor rects
      (`dancefloorRectsNear` consumption pattern:
      [chunks.js:1009](../../../src/chunks.js#L1009)) as a decal group. Plain
      materials; never `userData.shared`; never registered; NO castShadow
      (guardrails #5/#6).
      done = toggle on → rings visible in screenshot; toggle off →
      `renderer.info` geometry/texture counts return to pre-toggle values.
- [ ] 1.9 DEBUGGING.md: document all verbs + the layout-snapshot-vs-golden
      vocabulary note ("layout snapshot" ≠ "golden") in the same commit.
      done = DEBUGGING.md section exists; `__dbg.help()` lists every new verb.
- [ ] 1.10 festival.js comment fix (comment-only): the `stageScaleOf` mirror
      ([festival.js:105](../../../src/worldgen/festival.js#L105) block) cites a
      stale chunks.js line; buildStage now lives at
      [chunks.js:2258](../../../src/chunks.js#L2258) (scale draw ~2264).
      done = comment cites the current line; `git diff` shows comment-only.

## 2. `FESTIVAL_TUNING` hoist (GOLDEN-FROZEN — full gate ritual per commit; tuning freeze in effect)

- [ ] 2.1 Inventory the arrangement constants in the chunks.js worldgen builders
      (`buildVendorRowAt` [chunks.js:1236](../../../src/chunks.js#L1236),
      `buildFoodCourtAt` [chunks.js:1288](../../../src/chunks.js#L1288),
      `buildStage` [chunks.js:2258](../../../src/chunks.js#L2258), potty/camp/
      torch builders) + festival.js (`KIND_FOOTPRINT`
      [festival.js:196](../../../src/worldgen/festival.js#L196), walk distances,
      dancefloor bases). Write the in/out call (design D-B) as a header
      comment; near-duplicates marked "same number, two owners, do NOT merge
      yet" (guardrail #2).
      done = inventory comment lists every hoisted constant with its old
      file:line and every excluded near-duplicate with its reason.
- [ ] 2.2 Create `src/worldgen/tuning.js` — imports NOTHING; mutable-CONFIG +
      setter shape from day one (pattern: map-sandbox `setConfig`
      ~map-sandbox.html:577); analytic per-kind extent helpers; rewire
      festival.js + chunks.js to read it; dev-only drift assertions in
      chunks.js (derived value vs live model export, console.warn,
      localhost-gated); importmap entries in ALL FOUR html files (guardrail
      #8); dependency-direction rule in the header (worldgen/ never imports
      chunks/registry/lakes/models).
      done = game + map-sandbox + node selftest all run; grep shows zero
      remaining hoisted-constant literals at the old sites.
- [ ] 2.3 Gate: FULL ritual (APPLY-GUARDRAILS) — empty snapshot diff at 3 seeds
      incl. canary counts + both goldens unchanged + boot smoke both flag
      states + HUD budgets unchanged.
      done = ritual outputs pasted into the commit/session notes.

## 3. ~~Dry-run layout extraction~~ — DEFERRED to festival-zone-grammar

Deferred per deliberation 001 (design D-C′ hands the full extraction design
forward: model param splits across ~8 files, crowd pre-rolled params,
`env = {waterAt, blockedAt}`, Math.random transcribe-as-is). No tasks here.

## 4. Layout linter

- [ ] 4.1 `src/worldgen/lint.js` core: rules-as-data `{id, severity, mode,
      check}`; per-hub context from `festivalPlan` + tuning analytic extents +
      road/water queries; violation shape with the FULL eyes pipeline
      (map-sandbox 2D link + hub-sandbox `?at=x,z` 3D link + paste-ready
      `__dbg.teleport(x,z)` snippet); importmap in all four html files.
      done = `runLint({seeds:[1234]})` returns a violations array with all
      three link forms populated.
- [ ] 4.2 Plan-mode rules: `stage-spacing`, `spawn-arrival`, `water-clear`,
      approximate `overlap` + `truck-off-road` on analytic envelopes (labeled
      approximate). Dancefloor geometry reference:
      [festival.js:173](../../../src/worldgen/festival.js#L173) +
      [chunks.js:1009](../../../src/chunks.js#L1009).
      done = plan-mode sweep of 10 seeds completes headless in node in
      seconds and reports per-rule counts.
- [ ] 4.3 Registry mode (PRIMARY): accept `dumpRegistry` payloads / snapshot
      files; exact `overlap` (+ allowed-pairs table), `dancefloor-clear`,
      `booth-on-road`, `potty-attached`, `truck-off-road`, `water-clear` at
      sub-component granularity. Where modes disagree, registry mode is
      authoritative (spec text).
      done = the same seed linted in both modes produces a mode-tagged report;
      registry mode runs from a snapshot file with no game running.
- [ ] 4.4 Node CLI + `bin/lint` wrapper (selftest invocation style); document in
      DEBUGGING.md.
      done = `bin/lint --seeds 10` works from a clean shell.
- [ ] 4.5 Acceptance case (guardrail #1 applies — record, don't fix): lint seed
      `0xf7ef2a3c` (round-2 playtest, trucks-clipping-vendor-rows) in registry
      mode — the `overlap` rule MUST fire with a truck×vendor-booth pair.
      done = the violation is reproduced and screenshotted via its own 3D link.
- [ ] 4.6 `gotoHub(n)` prints that hub's violations (wire to 1.6).
      done = console output shows rule ids + links when teleporting to a
      known-bad hub.

## 5. Map-sandbox: true-extent overlay + seed gallery

- [ ] 5.1 True-extent layer from two sources: captured snapshot JSON (exact;
      fetch or file-drop) + analytic tuning envelopes (live, labeled
      approximate); layer toggle + `layers=` URL integration (existing layer
      plumbing: `layers` object + checkboxes, map-sandbox.html ~120/478);
      map-sandbox `wg` importmap array (~line 28) gains tuning/lint/extent
      modules.
      done = seed `0xf7ef2a3c` snapshot loaded → the truck×booth overlap is
      visibly overlapping in 2D; screenshot.
- [ ] 5.2 Point-inspector: per-record kind on hover for both sources (existing
      inspector: map-sandbox.html `#inspector`).
      done = hovering a truck circle names it.
- [ ] 5.3 `?gallery=N` contact-sheet mode: per-tile seed render centered on
      spawn hub, seed label, click → full map deep-link; render once, yield
      between tiles.
      done = `?gallery=12` paints 12 labeled tiles; click navigates.
- [ ] 5.4 Gallery lint counts via PLAN mode (no boots), progressive fill (tile
      paints first, count fills in).
      done = counts appear async after tiles; no boot required.

## 6. Hub viewer (`hub-sandbox.html`)

- [ ] 6.1 **[Fable/careful-Opus]** Extract the shared by-key unload walk from
      the chunk-removal path ([chunks.js:~340–400](../../../src/chunks.js#L340):
      shared-respecting dispose → `registry.removeChunk` (367) → crowd /
      stagePerformers / stageMusic / lenses / beams / cooks /
      forestAnimatables (388) / forestDrumCircles (392) / forestDrumMusic
      sweeps) into one exported helper; `_disposeChunk` path calls it.
      Behavior-identical refactor — run the FULL gate ritual on this commit.
      done = ritual passes; helper is the only place the sweep lists are
      spliced by key.
- [ ] 6.2 **[Fable/careful-Opus]** Export `buildHubPreview(scene, heart, opts)`
      from chunks.js: specced synthetic ctx {cx, cz, key, cxWorld, czWorld,
      rng, group, region, crowd} matching `_generateWorldgen`'s
      ([chunks.js:515](../../../src/chunks.js#L515) neighborhood); crowd = real
      instance or draw-faithful stub, NEVER omitted (crowd draw dependency:
      [crowd.js:338](../../../src/crowd.js#L338) /
      [chunks.js:2333](../../../src/chunks.js#L2333)); register the hub's
      worldgen lakes into the page registry BEFORE building;
      `hub-sandbox.html` scaffold w/ own importmap — **`'three'` → threeShim
      copied from [index.html:101](../../../index.html#L101), NOT
      sandbox.html** (guardrail #9) — flat ground, sandbox lighting + ToD
      presets, OrbitControls, `?seed=&hub=` + `?at=x,z` (nearest heart +
      replaceState), heart coords + rank displayed.
      done = `hub-sandbox.html?seed=1234&hub=0` renders the full spawn hub;
      `?at=` form resolves; no Sound.init needed or called.
- [ ] 6.3 Acceptance test: diff hub-viewer sub-component positions vs a game
      `dumpRegistry` at the same seed/hub/tier — every difference explained
      line-by-line or eliminated (STOP condition in APPLY-GUARDRAILS if not);
      rebuilds via the 6.1 shared teardown; ten same-value rebuilds → identical
      result (no leak feedback into `closestBuilding`,
      [registry.js:143](../../../src/registry.js#L143)).
      done = documented empty (or fully-explained) diff + the 10-rebuild check.
- [ ] 6.4 `FESTIVAL_TUNING` slider panel + copy-CONFIG (mirror map-sandbox
      TUNING·LIVE: h1 ~98 / syncTune ~526 / setConfig ~577; rebuild on
      drag-end or rAF-throttle — decide at build, note in code).
      done = dragging ring-radius slider visibly rebuilds the hub; copy CONFIG
      yields valid JSON.
- [ ] 6.5 Importmap consistency-checker script (node, sibling of
      bin/layout-snapshot): regex-extract module arrays from all FOUR html
      files, diff against src/ + src/worldgen/ contents, fail loudly.
      done = deleting one entry from one file makes the script exit non-zero
      naming file + module.
- [ ] 6.6 Docs: no-build.md ("every consuming html file" — four enumerated) +
      sandbox-and-testing.md (hub viewer renders new POI kinds by construction)
      + `src/worldgen/README.md` (tuning/lint modules, built-truth substrate,
      deferred extraction, env-injection + dependency-direction rules) +
      CLAUDE.md Run+verify table row for hub-sandbox.html.
      done = a fresh-session simulation: CLAUDE.md alone leads a reader to the
      hub viewer.
- [ ] 6.7 Verify: screenshot the same hub at Noon + Midnight; boot the REAL
      game after (sandbox-pass ≠ game-pass).
      done = both screenshots + clean game console logs on both flag states.

## 7. Playtest markers

- [ ] 7.1 Resolve key against the keydown handlers
      ([input.js:27](../../../src/input.js#L27) gameplay +
      [debug.js:727](../../../src/debug.js#L727) overlay) — `m`, else `k`;
      keypress appends {seed, x, z, heading, tod, sessionTime, note?} to
      localStorage `zerble_markers` + toast; PLUS the touch affordance (-> Q4
      answered: yes) — deliberately awkward gesture (e.g. triple-tap a HUD
      corner) + keyboard-free copy, so phone playtests on the deploy produce
      coordinates too.
      done = marker drops via key on desktop AND via gesture in mobile
      emulation (preview_resize); localStorage shows the full record shape.
- [ ] 7.2 Debug-overlay MARKERS section: list, per-marker editable note,
      copy-JSON, clear, per-marker teleport.
      done = drop 2 markers → both listed → teleport to first lands within 1m.
- [ ] 7.3 Confirm no player-facing copy mentions the key/gesture (Easter-egg
      rule); DEBUGGING.md markers section.
      done = grep of index.html/README/title copy shows nothing; docs updated.

## 8. Baseline + close

- [ ] 8.1 **[milestone]** Baseline from REGISTRY mode at `?perf=high`:
      `bin/layout-snapshot --seeds` across ≥10 seeds → per-rule violation
      counts as `verification/baseline.md` — Gary-legible format (rule |
      severity | total | worst seed | 2D link | 3D link + 2–3 hub-viewer
      screenshots of the worst offenders); plan-mode counts recorded alongside
      (the headless-vs-built gap is a tracked number). RECORD, do NOT fix
      (guardrail #1).
      done = baseline.md committed; a non-engineer can read it and point at
      the worst hub.
- [ ] 8.2 ROADMAP "Layout-work agent harness" trim sweep (per-commit CHANGELOG
      entries already landed with each group).
      done = ROADMAP section reduced to whatever genuinely remains.
- [ ] 8.3 Final smoke: boot `?worldgen=1` and `?worldgen=0` at seed 1234 +
      `?perf=low`, zero console errors; backtick budget panel unchanged
      in-game (harness adds no game-path draws).
      done = console logs + HUD screenshot at both flags, low tier included.
