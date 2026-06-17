# Council — Anthropologist (Experience Advocate)

## Anthropologist's Position

This change *is* a harness change, so the experience under evaluation is not the
player's drive — it's (a) the grammar-rewrite agent's edit→verify loop and
(b) Gary's playtest→feedback loop. The plan is squarely aligned with the
"build the harness, then the feature" doctrine, and several decisions are
exactly right for the humans involved (D-E's build-through-the-real-builders,
D-H's gallery-as-mode-not-new-tool, the marker concept itself). The gaps are
all closable cheaply, and they cluster in four places: the snapshot-capture
ritual (the hidden minutes), the violation→3D-eyes pipeline (Gary judges in
3D, not 2D overlays), the hub viewer's ring-index lookup (matches nobody's
mental model), and discoverability for a fresh post-compact agent (CLAUDE.md's
Run+verify table is untouched by any task).

### Priority Sequence

1. **Script the snapshot ritual before group 2 starts** (Finding 1) — groups
   2–3 repeat the capture~50 times; task 1.2's "documented jq one-liner" is
   the most-repeated operation in the change and the only place the loop is
   minutes, not seconds.
2. **Make every lint violation emit a 3D path** (Findings 2, 3) — hub-sandbox
   `?at=x,z` + a paste-ready `__dbg.teleport` snippet. Without this the
   linter's output is legible to agents and illegible to Gary.
3. **Close the discoverability holes in the same commits** (Finding 6) —
   CLAUDE.md Run+verify row for hub-sandbox, DEBUGGING.md homes for lint CLI /
   gallery / markers. A tool a fresh session can't find doesn't exist.
4. **Decide the marker mobile story honestly** (Findings 4, 5) — keyboard-only
   as spec'd; either scope it to desktop explicitly or add a touch affordance.
5. Everything else (baseline format, slider debounce, gallery progressive
   counts) — note-at-build items.

## The agent loop as-shipped

Two distinct loops. Walked concretely against what the tasks actually ship:

### Loop A — the grammar-rewrite agent (the consumer this change exists for)

1. Edit `src/worldgen/festival.js` / `layouts.js` / `tuning.js`.
2. Lint: `node --input-type=module -e "import('./src/worldgen/lint.js').then(m=>m.cli())" -- --seeds 10`.
   Pure worldgen, no three.js — this should run in low single-digit seconds
   even at 10 seeds (festivalPlan is memoized per seed/epoch; the per-hub
   context assembly is arithmetic). **The cost is not runtime, it's the
   incantation** — see Finding 7.
3. Visual 2D: reload `map-sandbox.html?seed=S&layers=…` with the true-extent
   layer. Seconds; serve_nocache handles module reload. ✓
4. Visual 3D: reload `hub-sandbox.html?seed=S&hub=0`. Seconds, no server
   restart (static page, own importmap list). ✓ — **but finding the right
   `hub=n` for a violation at (x,z) is manual ring-index guessing** (Finding 3).
5. Distribution: `?gallery=12` with lint counts per tile. Tens of seconds,
   acceptable for a per-milestone check. ✓
6. In-context: boot the game, `__dbg.start()` → `gotoHub(0)` → screenshot.
   ~1 minute, appropriately reserved for milestone gates. ✓

Verdict on Loop A: genuinely seconds per iteration **once steps 2 and 4 get
their affordances** (a `bin/lint` wrapper; `?at=x,z`). Manual steps remaining
as-shipped: remembering the CLI string, hand-translating violation coords into
a hub index or a teleport call.

### Loop B — this change's own golden-frozen refactors (groups 2–3)

Per commit (×~8 commits: hoist + 7 builder extractions), the D-A gate is:

1. Boot preview at `?worldgen=1&seed=S`, `__dbg.start()`, wait for chunks.
2. `preview_eval`: `dumpRegistry()` → copy JSON out → save to `verification/`.
3. Repeat at 3 seeds (pre-refactor captures exist from task 1.2; post-refactor
   captures are fresh each commit).
4. Normalize both sides (the "tiny script or jq one-liner"), diff, expect empty.
5. Run both determinism goldens.
6. Boot smoke `?worldgen=1` AND `?worldgen=0`.

That is ~50 capture-normalize-diff cycles across the change, each one a
multi-step browser ritual as specified. **This is where the hidden minutes
live**, and it's this change's own throat, not the grammar agent's — which is
exactly why it'll get skimped under fatigue unless it's one command
(Finding 1). A skipped or sloppy gate here is how a silent rng-order drift
ships, so the ergonomics of the gate are a *determinism* control, not a
nicety.

### Experience Concerns

-   **Player**: none directly — correctly zero player-visible behavior. The
    one player-adjacent surface is the marker hotkey, which must stay out of
    player-facing copy (task 7.3 covers it) and whose toast must read as a
    quiet dev affordance, not a game feature. Indirectly, this change is the
    gate for fixing the "jumbled mess" — the player benefit is the follow-up.
-   **Next agent / dev**: the strongest part of the plan is D-E — building the
    hub viewer through the real `buildWorldgenKind` means new POI kinds render
    with zero registration, so the new-model checklist doesn't grow a fourth
    leg. The weakest parts are the snapshot ritual ergonomics (Finding 1), the
    violation→3D gap (Finding 2), and three discoverability holes (Finding 6).
-   **Cognitive Load**: the change adds one new page, one new URL grammar
    (`?seed=&hub=`), four `__dbg` verbs, two map-sandbox modes, and a CLI —
    all following existing patterns (camLock plumbing, TUNING·LIVE, layer
    toggles, selftest invocation style), which keeps the concept count
    honest. The one genuinely new concept an agent must learn is the
    **layout-snapshot vs. determinism-golden distinction**; D-A's vocabulary
    note is good — carry it into DEBUGGING.md verbatim, since "golden" is a
    known confusion point for Gary.

## Findings

1.  **[HIGH] The D-A snapshot gate is a multi-step manual ritual repeated ~50
    times.** Evidence: tasks.md group preamble ("Every commit in 2–3 must
    show: empty layout-snapshot diff (3 seeds) + …") × ~8 commits × 2 sides;
    task 1.2 specifies only "a tiny script or documented jq one-liner" for
    normalization and nothing for capture. The capture is necessarily
    browser-side (the registry only exists in the booted game; node can't
    resolve the CDN importmap), so as written it's: boot, `__dbg.start()`,
    wait, `dumpRegistry()`, copy, save, normalize, diff — per seed, per side,
    per commit. **Recommendation:** promote task 1.2 to a real tool:
    `bin/layout-snapshot <seed> [out.json]` (precedent: `bin/readme-sync` is
    already a standalone bash script in `bin/`) wrapping a documented
    preview-MCP/agent-browser recipe, plus a normalizer that makes the gate
    `diff <(normalize a) <(normalize b)`. Put the full copy-paste recipe in
    DEBUGGING.md in the task-1.x commit. The gate's ergonomics ARE the
    determinism control — a tedious gate is a skipped gate.

2.  **[HIGH] The violation→eyes pipeline ends in 2D, but Gary judges in 3D.**
    Evidence: design D-D — `link` is a `map-sandbox.html?seed=&cx=&cz=&zoom=`
    deep-link only; prior-session memory is explicit that Gary evaluates
    festival work as in-game 3D screenshots, not map overlays. A linter whose
    output Gary can't *see* in his own terms will produce baseline numbers he
    has to take on faith. **Recommendation:** every violation emits **both**
    links — the map-sandbox 2D link AND a hub-sandbox 3D link (needs
    Finding 3's `?at=x,z`) — plus a paste-ready `__dbg.teleport(x, z)` snippet
    in the CLI output. Resolve the design open question ("should `gotoHub`
    print that hub's lint violations?") as **yes** — that closes the loop in
    the other direction. Combined, "show me this violation in 3D" becomes one
    click or one paste.

3.  **[MEDIUM-HIGH] `?hub=n` (ring-ordered index from origin) matches nobody's
    mental model.** Evidence: design D-E / layout-surfaces spec. A lint
    violation knows `hub:{x,z,rank}` and coordinates; Gary knows "the hub I'm
    standing at"; neither knows ring-order rank without computing it.
    **Recommendation:** (a) hub-sandbox accepts `?at=x,z` → nearest heart,
    and `replaceState`s to a canonical URL (map-sandbox already does exactly
    this pattern, map-sandbox.html:146); (b) the viewer displays the heart's
    world coords + rank on screen so URLs round-trip; (c) `gotoHub(n)` prints
    the equivalent hub-sandbox URL to console, bridging game → viewer ("I'm
    looking at it in-game, give me the rebuildable isolated view").

4.  **[MEDIUM] The marker hotkey's prime scenario fails on mobile.** Evidence:
    design D-G says "Markers are localhost-and-production both (Gary playtests
    the deploy)" and the layout-debug-tools scenario is "Gary taps the marker
    key when he sees a layout problem mid-drive" — but the marker is a
    keypress, the copy-out lives in the backtick overlay, and the overlay
    opens only via `e.code === 'Backquote'` (debug.js:728). On a phone there
    is no key, no overlay, and the localStorage list is stranded per
    device+origin (a marker dropped on the deployed game on Gary's phone is
    unreachable from a localhost agent session regardless). **Recommendation:**
    either (a) scope v1 explicitly to desktop playtests and say so in the spec
    scenario, or (b) add one touch affordance (e.g. a long-press/triple-tap on
    an existing HUD element drops a marker; markers list gets a share/copy
    button reachable without a keyboard). Don't ship a spec whose flagship
    scenario silently excludes the device half the playtesting happens on.

5.  **[MEDIUM] The `note?` field was dropped between proposal and tasks.**
    Evidence: proposal.md marker shape includes `note?`; task 7.1 and the
    layout-debug-tools spec shape (`{seed, x, z, heading, tod, sessionTime}`)
    omit it. A bare coordinate a week later is "something was wrong here,
    guess what" archaeology — the marker exists precisely to carry intent.
    **Recommendation:** keep `note` optional; mid-drive typing is not required
    — the overlay's MARKERS section gets a per-marker edit field so Gary
    annotates after the run, before copy-JSON. Copy-JSON-into-chat is the
    right agent handoff (localStorage is origin-bound; don't over-engineer a
    sync), but the JSON should be worth reading.

6.  **[MEDIUM] Three discoverability holes for the fresh post-compact agent.**
    Evidence: (a) CLAUDE.md's Run+verify table — the canonical "which URL for
    which job" map — has rows for `sandbox.html`, `/`, and `map-sandbox.html`;
    no task adds a `hub-sandbox.html` row (task 6.4 updates no-build.md +
    sandbox-and-testing.md only). (b) Group 7 has no docs task at all — the
    marker system's internal documentation home is unassigned. (c) The
    `?gallery=N` flag and the lint CLI command have a home (task 4.5 names
    DEBUGGING.md for the CLI) but map-sandbox's new modes don't.
    **Recommendation:** add to group 8: CLAUDE.md Run+verify gains the
    hub-sandbox row (one line: "one complete hub in 3D — layout/arrangement
    changes"); DEBUGGING.md gains a "layout verification" section covering
    lint CLI, gallery, markers, and the layout-snapshot vocabulary note from
    D-A. CLAUDE.md is the only always-loaded doc — a surface absent from it
    is invisible to a fresh session.

7.  **[LOW-MEDIUM] The lint CLI incantation is hostile to recall.** Evidence:
    design D-D — `node --input-type=module -e "import('./src/worldgen/lint.js').then(m=>m.cli())" -- --seeds 10`,
    matching selftest's style (src/worldgen/README.md:27) — which is a
    precedent of *necessity* (no package.json), not of *virtue*. `bin/` already
    holds a standalone bash script. **Recommendation:** ship `bin/lint`
    wrapping the node invocation (and `bin/layout-snapshot` per Finding 1).
    The selftest could adopt the same pattern later; don't propagate the
    incantation to a second tool.

8.  **[LOW] baseline.md as specified is agent-legible, not Gary-legible.**
    Evidence: task 8.1 / layout-linter spec — "per-rule violation counts per
    seed." Counts answer "how much" but not "how bad does it look," which is
    the register Gary actually communicates in (playtest rounds 1–2 were
    prose + feel). **Recommendation:** fix the baseline format now so the
    grammar change can maintain it as a before/after: one table — rule |
    severity | total across the seed set | worst seed | 2D link | 3D link —
    plus 2–3 hub-sandbox screenshots of the worst offenders embedded in the
    doc. Also note: `verification/baseline.md` lives in this change's folder,
    which moves to `archive/` on completion — the grammar change should
    either copy the baseline forward or pin the archived path explicitly in
    its proposal, or the measuring stick goes stale-linked.

9.  **[LOW] Hub-viewer slider "instant rebuild" needs a debounce decision.**
    Evidence: D-E — "drag → rebuild the one hub (instant)." A full
    festivalPlan + all-builders rebuild per drag *event* (dozens/sec) could
    stutter on a large hub and make the slider feel broken — the opposite of
    the fluid-iteration goal. **Recommendation:** rebuild on rAF-throttle or
    drag-end; decide at build, note it in task 6.3.

10. **[LOW] Gallery lint counts (task 5.4) should render progressively.**
    Evidence: D-H renders tiles "sequentially with a yield"; adding an
    in-browser lint run per tile at page load multiplies that. Fine for a dev
    page, but paint the tile first and fill the count in as it computes, so
    the contact sheet never feels hung.

### Experiences Not Addressed

-   As Gary, I'd expect to drop a marker on my phone while playtesting the
    deploy mid-drive, but the plan's marker is a physical keypress and the
    copy-out lives behind a keyboard-only overlay (→ Finding 4).
-   As Gary, I'd expect "the linter found 37 problems" to come with pictures
    of the three worst ones in 3D, but baseline.md as specified is a table of
    counts and the violation links land me in a 2D map (→ Findings 2, 8).
-   As the next agent (post-compact), I'd be unable to discover
    `hub-sandbox.html` exists at all, because the Run+verify table in
    CLAUDE.md — my first and sometimes only orientation read — isn't updated
    by any task (→ Finding 6).
-   As the agent executing groups 2–3, I'd be unable to run the snapshot gate
    in one command, because capture is an undocumented browser ritual and the
    normalizer is "a jq one-liner" — so under fatigue I'd be tempted to gate
    on goldens alone, which is precisely the gap dumpRegistry exists to close
    (→ Finding 1).
-   As the grammar-rewrite agent, I'd be unable to go from a violation's
    coordinates to the matching hub-sandbox view without hand-computing a
    ring-order index (→ Finding 3).

### Verdict

-   **Verdict**: Proceed with mitigations
-   **Key Concern**: The D-A snapshot gate — the change's own determinism
    control — is specified as a manual browser ritual repeated ~50 times;
    tedious gates get skipped, and a skipped gate here ships silent world
    drift. Script it (`bin/layout-snapshot` + normalizer) before group 2.
-   **Recommendation**: The plan is the harness doctrine done properly — the
    hub viewer through real builders, gallery as a mode, markers as
    coordinates are all the right shape. Land it with these cheap additions:
    one-command snapshot capture, `?at=x,z` on hub-sandbox, dual 2D+3D links
    (+ teleport snippet) on every violation, `gotoHub` printing violations, a
    CLAUDE.md Run+verify row, a marker `note` field, and an honest
    desktop-only scope (or one touch affordance) for the marker hotkey. None
    of these moves the architecture; all of them decide whether the harness
    gets *used* or merely *built*.
