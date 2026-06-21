## Pragmatist's Position

> Lens: fastest path to a Gary-visible, gate-verified win without cutting the
> determinism / boot / perf corners. Grounded in `verification/baseline.md`
> (reproduced live: seed 1234 = 10 err / 8 warn, seed 42 = 4 err / 1 warn),
> `src/worldgen/festival.js` (503 lines), `src/chunks.js` builders (2729 lines),
> `src/crowd.js` `spawn()` at :338, and harness design **D-C′**.

### Critical Path

The longest hard-dependency chain in this plan, and why each link is load-bearing:

```
extract buildVendorRowAt/FoodCourtAt/CampVillageAt → buildStage (Math.random trap)
        ↓ (records exist)
crowd pre-rolled params (D2) — REQUIRED before any slotting capture is tier-stable
        ↓
true oriented extents (D3) — REQUIRED before the planner can test shapes
        ↓
zone-slotting planner + THE GOLDEN MOVE (D4/D6) — the one irreversible commit
        ↓
registry backstop (D5) → baseline burndown to 0 (group 6) → judge (group 7)
```

The chain is real but **shorter than it looks**. The thing that gates the
Gary-visible payoff is groups 3→4 (extents + slotting). Groups 1–2 (the ~8-builder
extraction + crowd) are a *behaviour-preserving substrate* that produces **zero
visible change** by construction — every commit is snapshot-diff-EMPTY-gated. That
is the heart of my domain concern: **the largest, riskiest block of work (groups
1–2) ships no player-visible win and no burndown progress.** Eight builders + crowd
surgery, each gated on an EMPTY diff, is the repo's riskiest refactor class (D1
says so, D-C′ says so) — and it's all upfront, all invisible.

So the pragmatist question the briefing asks — *is the FULL ~8-builder extraction
needed before ANY layout improvement?* — the honest answer is **no, not all of it,
and the plan already half-knows this** (open question in design.md: "How many
builders actually need the full layout/mesh split vs. just a records-emitting
wrapper"). I want that open question resolved BEFORE group 1 starts, not "scoped
per-builder during D1," because it determines whether this is a 2-week grind or a
4-day one.

### Priority Sequence

1. **Resolve the extraction-scope question FIRST (a 1-day spike, before group 1).**
   The reproduced lint counts tell us exactly which builders the burndown actually
   needs. The **error** rules are: `water-clear` (58), `overlap` (48),
   `arch-placement` (21), `drum-in-trees` (8). Decompose by which builder owns each:
   - `arch-placement` (21, fires on nearly every seed — baseline note calls it a
     *global* "arch system is wrong" flag) is owned by the **arch placement in the
     planner**, NOT by any mesh extraction. The arch isn't even in the group-1
     builder list. This rule can fall to ~0 from a **planner-only change** — it
     needs the front-axis threshold logic (D4 step 6), not the vendor/food/camp/
     stage extraction.
   - `overlap` (48) and `drum-in-trees` (8) need true extents (D3) + slotting (D4),
     which need the planner to *know* the oriented shapes. Per harness D-C′ §"What
     the grammar change's planner needs on day one is true extents, which the
     analytic helpers (D-B) provide **without per-record data**." That is the
     unlock: **the planner can get true extents from the existing `clusterExtent`
     analytic helpers WITHOUT the full layout/mesh record extraction.**
   - `water-clear` (58) is cluster-center-vs-every-sub-component (baseline gap
     table). Slotting whole zones clear of water mostly fixes it at the planner
     level; the residual (a truck on the ring edge dipping into water) is what the
     registry backstop (D5) catches — again, planner + backstop, not full extraction.

   **The spike's deliverable:** a table mapping each error rule → the minimum
   builder/planner change that zeroes it. My strong prior, from the reproduced
   counts and D-C′, is that **the four error rules are drivable to zero by D3
   (analytic extents) + D4 (slotting) + D5 (backstop) — and the full per-record
   layout/mesh extraction of all 8 builders is only strictly required for D2's
   tier-stability and for the per-record cosmetic data the *warns* want.** If that
   holds, we can re-sequence to deliver the visible win far earlier (see Slice 1).

2. **The two genuinely-required extractions for the golden move: crowd (D2) and
   the stage/vendor extent source.** D2 is the one extraction that *must* land
   before the golden move, because the baseline was captured at `perf=high` and the
   shipped low/mid worlds disagree (harness R2). If you move the POI golden (D6)
   while crowd still draws from the cluster rng with a tier-sized pool, you bake a
   `perf=high`-only golden and the low/mid worlds silently diverge from it.
   Reproduced: `crowd.spawn` (`src/crowd.js:338`) pulls ~10 `rng()` draws per NPC
   (`:343–395`) off the passed-in stream, and `MAX_NPCS = PERF.crowdMax`
   (`:30`) caps the count by tier. This is real and must precede group 4.

3. **D3 extents (analytic, read-only) — point the linter + overlay at them.** This
   is pure measurement upgrade, golden-frozen, independently shippable. It makes
   plan-mode lint converge toward registry-mode (the baseline gap table: `overlap`
   plan 632 vs registry 48 is the over-count this fixes), which makes the burndown
   loop in group 6 trustworthy headlessly. **Force multiplier:** once plan-mode is
   shape-accurate, the burndown iterates in seconds via `bin/lint --seed-list`
   over 10 seeds with no 90-second capture per change.

4. **The slotting planner + golden move (D4/D6) — the single visible-win commit.**
   This is where Gary sees the fix in the hub viewer. One commit, golden re-recorded
   once, node==browser re-verified.

5. **D5 backstop, then group-6 burndown to zero, then group-7 judge.** Backstop is
   the graceful-degradation safety net; burndown is the numeric proof; judge is the
   Gary-visible proof.

6. **The remaining full per-record builder extractions (the parts NOT needed to
   zero the error rules) — fold in opportunistically or park.** If the spike (step
   1) confirms some builders only need a thin records-emitting wrapper to satisfy
   the warns, do those *after* the error rules are at zero, when the visible win is
   already banked.

### Force Multipliers (where the harness lets us move fast)

- **`bin/lint` over 10 frozen snapshots is the burndown dashboard.** Reproduced
  live — seed 1234 prints 10 err / 8 warn with paste-ready `at=x,z` 3D links per
  violation. Every commit in groups 3–6 can re-run all 10 seeds in seconds and show
  the per-rule count drop. **This is what makes per-rule sequencing possible** (see
  below). Use it as the commit gate, not just the final gate.
- **The hub viewer (`hub-sandbox.html` / `?entity=hub_preview&seed=&at=`) renders
  the offender by construction.** baseline.md's worst-offenders table hands us 8
  exact teleports (seed 1234 tent×truck 7.5m @ `__dbg.teleport(342,-38)`). The
  before/after screenshot for `verification/burndown.md` (task 6.3) is a 2-URL diff,
  not a driving session. This is the cheapest Gary-facing proof in the repo.
- **The draw-count canary + snapshot diff localize extraction breakage to one
  builder.** D1's one-builder-per-commit discipline means a broken extraction can't
  hide. Lean on it hard — don't batch two builders into one commit to "save time";
  that defeats the localization that makes the riskiest refactor class survivable.

### Per-rule burndown CAN be sequenced — each commit shows progress

This directly answers the briefing's last question. The error rules are
**independently attributable to different planner mechanisms**, so the burndown is
NOT a single big-bang. Proposed commit-by-commit progress (each a green-going-down
row in `bin/lint --seed-list`):

| Commit | Mechanism | Rule(s) driven down | Visible? |
|---|---|---|---|
| A | arch as road-threshold (planner) | `arch-placement` 21 → ~0 | yes (arrival check, task 7.2) |
| B | analytic extents into planner overlap test | `overlap` 48 → low | numeric |
| C | drum into forest clearing + access path | `drum-in-trees` 8 → 0 | yes |
| D | slot whole zones clear of water | `water-clear` 58 → low | numeric |
| E | registry backstop (D5) | residual `overlap`/`water-clear` → 0 | numeric |

The golden moves ONCE (it must — D6), at the first commit that changes
`festivalPlan` output (commit A or B, whichever lands first). After that single
move, commits B–E each show a falling count against the *new* frozen golden. So the
discipline is: **golden move is one commit; burndown progress is many commits, each
a measurable step.** That sequencing is achievable and I recommend it explicitly —
it turns an opaque "did the rewrite work?" into five legible wins.

### Effort reality check

- **The ~8-builder extraction is the optimistic-estimate trap.** `buildStage`
  (`chunks.js:2374`, ~150 lines) alone has the `Math.random()` trap (`:90–91`,
  arc-width/height cosmetic draws that MUST stay `Math.random()` per D-C′ point 4)
  living *interleaved* with seeded `ctx.rng()` draws (`:116–146`, clump/chair/
  blanket counts). Transcribing that split without perturbing the seeded stream
  order is delicate surgery — a misplaced draw shifts every downstream `rng()` and
  blows the snapshot diff. Budget this as the single hardest commit. "Split a
  builder" is not uniform effort; this one is 3–5× the vendor row.
- **`buildCampVillageAt` (`:1509`) has `registry.closestBuilding` INSIDE the draw
  loop** (`:13`, `:37`) — D-C′ point 3. Its layout half "stays approximate by
  construction." So a pure `layout(rng,env)→records` for camps is **not fully
  achievable** — the records can't predict which tents the live registry will
  reject. The plan acknowledges this (D5 runs in the mesh half), but it means the
  camp extraction is a *partial* split, and anyone expecting a clean pure function
  will burn time fighting an unwinnable abstraction. Set that expectation now.
- **crowd (D2) is the highest-payoff extraction** — it both enables the golden move
  to be tier-honest AND closes harness R2 (tier-dependent layouts). Reproduced: it's
  a localized change to `spawn()` (`crowd.js:338`) consuming pre-rolled params + the
  4 call sites in chunks.js (`:1698,:1706,:2466,:2723`). Bounded, well-understood,
  do it early.

### Deferred / Park on ROADMAP

- **Per-truck cosmetic customization within a court** — already a non-goal
  (design.md). Stays parked. Blocks nothing.
- **The `DEFAULT_WORLDGEN_V2` flip** — explicitly a separate later change
  (design.md non-goals; v2 HANDOFF H.3/F.5+I). Do NOT let it creep into this change.
  The flag stays OFF; that's what makes the golden move safe. Deferring it blocks
  nothing in this change.
- **The full per-record layout/mesh extraction of builders whose records the ERROR
  rules don't need** (pending the step-1 spike result). If a builder's only payoff
  is satisfying a *warn* (`booth-on-road`, `dancefloor-clear`, `potty-attached`),
  do it after the error rules hit zero. Deferring it does NOT block the numeric
  success criterion (every error rule → 0) or the Gary-visible win.
- **`booth-on-road` threshold refinement** (design open question — baseline's
  largest warn at 74). It's a *warn*, and the baseline note says it may be a
  linter-threshold question ("straddle is allowed, on-surface is not"), not a
  placement bug. Park the rule-tuning decision; don't gate the change on it.
- **`task 1.6` model-builder param splits (`buildTent`, `buildCampChair`)** — only
  needed where a mesh builder draws rng mid-loop AND that affects a record the
  planner consumes. Triage in the spike; defer the ones that don't move a rule.

### Incremental Delivery Plan

- **Slice 0 (spike, ~1 day, ships nothing): extraction-scope triage.** Map each
  error rule → minimum builder/planner change. Deliverable: a table that says which
  of the 8 builders are on the critical path to zero-error and which are warn-only.
  This is the cheapest insurance against grinding the full extraction before any
  win. Verify: the table, reviewed against reproduced `bin/lint` counts.

- **Slice 1 (FIRST visible win): arch-as-threshold + crowd pre-roll + analytic
  extents → golden move.** This is the smallest set that (a) lands the one
  deliberate golden move, (b) makes crowd tier-honest so the golden is valid at all
  tiers, (c) zeroes `arch-placement` (21, the most-firing error rule, visible at the
  arrival check), and (d) makes plan-mode lint shape-accurate so the rest of the
  burndown is fast. Verify: `bin/lint --seed-list` over 10 seeds shows
  `arch-placement` falling; hub-viewer screenshot at seed 1234 `at=295,-74` shows
  the arch on the road ahead of the stage (task 7.2); boot the real game
  `?worldgen=1` at `perf=low` AND `perf=high`, identical normalized layout (closes
  R2). Depends on Slice 0.

- **Slice 2 (the bulk of the burndown): slotting commits B–E.** Overlap via extents,
  drum into forest clearing, zones clear of water, registry backstop. Each commit a
  falling `bin/lint` count against the now-frozen golden. Verify: every error rule →
  0 across 10 seeds (task 6.1); the 4 named worst offenders clean at their exact
  coords (task 6.2); `verification/burndown.md` before/after table + 3 hub-viewer
  screenshots (task 6.3). Depends on Slice 1's golden move.

- **Slice 3 (cleanup, optional/parkable): the warn-only builder extractions + warn
  burndown.** The per-record splits that only the warns need, plus any
  `booth-on-road` threshold decision. Independently shippable; can slip to a
  follow-up commit or even a follow-up change without endangering the numeric
  success criterion. Depends on nothing in Slice 2 being incomplete.

### Verdict

- **Verdict**: Proceed with mitigations.
- **Key Concern**: The plan front-loads its largest, riskiest, *invisible* work —
  the full ~8-builder behaviour-preserving extraction (groups 1–2) — before any
  burndown progress or Gary-visible win, and defers "how many builders actually need
  the full split" to "scope per-builder during D1." Reproduced lint counts + harness
  D-C′ ("the planner needs true extents on day one, which the analytic helpers
  provide *without* per-record data") strongly suggest the four ERROR rules are
  drivable to zero by **analytic extents + slotting + registry backstop**, with the
  full per-record extraction strictly required only for crowd tier-stability (D2)
  and for the *warns*. Resolve that scope question in a 1-day spike (Slice 0)
  BEFORE group 1, so the riskiest refactor isn't done speculatively.
- **Recommendation**: Proceed. The instrument is real and reproducible (verified:
  baseline.md counts match live `bin/lint`), the golden-move discipline is sound,
  and the harness makes both iteration (plan-mode sweep) and proof (hub viewer)
  cheap. Two mitigations: (1) front-load the extraction-scope spike and only extract
  builders on the critical path to zero-error first; (2) sequence the burndown
  per-rule (arch → overlap → drum → water → backstop) so the golden moves once but
  five legible commits each show a falling count — turning an opaque rewrite into a
  visible, gate-verified progression.
