# Tasks: festival-run-stakes

Phases per design D11: groups 1–2 = P1 (name + toasts + board shell), groups 3–7 = P2
(Festival Run core), group 8 = P3 (Worker + global board), group 9 = wrap-up. Each
phase ends shippable; CHANGELOG per phase. Amended per the council synthesis
(`deliberations/001-initial/results.md`) — the amendments are baked into the task
wording below; `bin/test-*` scripts are written ALONGSIDE their modules, and gate in
group 9. Importmap rule everywhere: new `src/` modules go in the THREE full pages
(`index.html`, `sandbox.html`, `hub-sandbox.html`) — `map-sandbox.html` is
worldgen-only.

## 1. Name entry + toast weaving (P1)

- [x] 1.1 Title card: add name input (max 20, trimmed, aria-labeled) + leaderboard
      disclosure line to `index.html`; persist/prefill via `zerble-player-name`;
      verify the start tap still reaches `Sound.init()` synchronously (read the code
      path, then boot-test on the preview)
- [x] 1.2 `hud.js`: expose `getPlayerName()` / name-aware toast formatting helper
      (`fmt(line)` interpolating `{name}` with nameless fallbacks)
- [x] 1.3 Weave name variants (≈1-in-4, with fallbacks) into existing toast banks in
      `main.js` (collision quips, milestone, out-of-juice nudge, wook offer/narration,
      vendor lines) — single helper, no per-bank forks
- [x] 1.4 Analytics: `name_entered` / `name_length` on start; assert no name string in
      any payload (grep + runtime spot-check)
- [x] 1.5 Boot the main game (title → start → 2.5s → console clean) + screenshot proof
      of a named toast

## 2. Local leaderboard storage + score screen shell (P1)

- [x] 2.1 New module `src/leaderboard.js`: local top-10 CRUD on
      `zerble-leaderboard-local` (insert ranked, cap 10, tolerate corrupt JSON,
      blank-name runs render a fallback display name — "ZERBLER" — matching the
      Worker spec's promise); importmap entry in the THREE full pages;
      `bin/check-importmaps` passes
- [x] 2.2 Score-screen overlay in `index.html`/`hud.js`: cause, score, days, best
      combo, local board table (with the blank-name fallback), "run again" / "back to
      title"; reachable (view-only board) from the title card; hidden entirely in
      Just Cruisin'
- [x] 2.3 Verify empty-state + seeded-state rendering via `__dbg` hook
      (`__dbg.showScoreScreen(mock)`) and screenshots at two ToD presets

## 3. Modes + mode config (P2)

- [x] 3.1 New module `src/runMode.js`: mode-config objects (Cruisin' = today's
      constants; Festival Run = day-ramp table D6, combo tuning D5), day-ramp lookup
      helpers; write `bin/test-run-mode` (ramp lookups) alongside it; importmap ×3 +
      check-importmaps
- [x] 3.2 Title card mode selector (two buttons, persisted preselect, aria); with NO
      persisted preference, **Just Cruisin' is the default-highlighted choice**
      (design D13 — a returning player's habitual Start tap must never land in stakes
      mode unwarned); mode plumbed into `main.js` boot; no async in the start path
- [ ] 3.3 Resume snapshot: carry mode + run state (clock, day, score, high-water,
      combo, vibe, rescue flag, token) through the sessionStorage snapshot and
      restore path. **Acceptance:** the day-counter wrap detection's `prevT`
      initializes from the RESTORED `t`, not a fresh-boot default (a reload near a
      day boundary must not double-count a day)
- [x] 3.4 Mode-gate the personal best: `HUD.saveBest()` / `Analytics.personalBest`
      calls (`main.js:904`, `main.js:1580`, `__dbg.addSmiles`) fire ONLY in Just
      Cruisin' — Festival Run scores must never touch `zerble-best-smiles`
      (council Critical finding; design Migration Plan)
- [x] 3.5 A/B invariance check #1: same seed, both modes — `dumpRegistry` diff empty
      in Cruisin' vs pre-change; no stakes HUD in Cruisin' (screenshot both)

## 4. Scoring pipeline + combo (P2)

- [x] 4.1 New module `src/scoring.js` per design D4 (collect/award/deduct/breakCombo/
      setDoubler/pinCombo, high-water ratchet, chain window); write `bin/test-scoring`
      (chain thresholds, high-water ratchet, ×2 doubler stacking) alongside it;
      importmap ×3
- [x] 4.2 Route ALL existing score writes through it: smile collect callback, frown
      deduction, `__dbg.addSmiles`; `rg 'score'` sweep confirms no stray writers.
      **Immediately after this lands, re-run the A/B invariance check** (same drill
      as 3.5) — this reroute is the change most likely to leak stakes into Cruisin'
- [x] 4.3 Smile collect event: `smiles.js` onCollect → scoring + audio hook with
      same-frame burst coalescing
- [x] 4.4 HUD combo badge (multiplier, draining chain ring, ♥×2 slot) — dirty-flagged
      DOM like existing HUD; hidden in Cruisin'. Verify legibility **at driving
      speed** (drive + screenshot), not only via static `__dbg` poses
- [x] 4.5 Star power pins combo at cap for its duration (wire `StarPower.onTrigger/
      onEnd`)
- [ ] 4.6 Lurleen: expose `isFollowing`; scoring doubler + ♥×2 track it same-frame;
      scare-off on damaging NPC hit (Festival Run only, via the 6.5 gate) with
      re-approach cooldown + startled beat
- [x] 4.7 Verify: `__dbg` combo drills (addSmiles bursts, forced hit) + screenshot of
      badge states; boot main game clean

## 5. Smile SFX pitch ladder + stakes cues (P2)

- [ ] 5.1 `sound.js`: pentatonic ladder blip voice (detune, 6-voice cap, same-frame
      chord coalesce) driven by combo chain count; frown down-note; on SFX bus
- [ ] 5.2 `sound.js`: sputter loop, marshal whistle, run-end stings (`ran_dry` vs
      `vibed_out`)
- [ ] 5.3 Sandbox audio panel spot-check ("Hit it" surfaces unaffected) + in-game
      ladder verify via `__dbg` smile bursts; confirm no init-chain changes (iOS
      tripwire re-read)

## 6. Festival Run stakes: economy, sputter, vibe, deaths (P2)

Checkpointed per council: land the DRY-DEATH path end-to-end (6.1–6.4 + the
`ran_dry` half of 6.7, proven by the 6.8 drill) BEFORE starting vibe-out (6.5) or
rescue (6.6). Two novel death machines never debug together.

- [ ] 6.1 New module `src/runState.js`: run clock, day counter (from ToD cycle
      crossings; `prevT` from restored `t` per 3.3), sputter state machine (45s
      grace), vibe meter (strike weights, decay, warn/eject thresholds from ramp),
      death causes, rescue flag; `__dbg` hooks: `runDay(n)` day-jump/ramp override +
      `vibe(n)` meter nudge (harness doctrine — Day-5 tuning must not cost 30 real
      minutes); write `bin/test-run-state` (sputter/vibe machines, strike decay,
      day-counter resume init) alongside; importmap ×3
- [ ] 6.2 Jug availability runtime filter (fresh `JUG_FILTER_SALT`, keep-fraction by
      day). **Acceptance (determinism-critical):** the filter applies ONLY to the
      ambient `scatterBubbleJugs` scatter (`chunks.js:2130`) — `_placeSpawnJugs`
      intro jugs are exempt — and the mode/day check gates ONLY the final
      `buildBubbleJug()`/`group.add`/`registry.add` triplet, strictly AFTER all
      `ctx.rng()` draws for that jug complete (`scatterWorldgenCampsites` depends on
      draw-count parity, `chunks.js:2156`). Live day-state reaches chunks via the
      documented module-level setter (design D3), defaulting to UNFILTERED so
      hub-sandbox/map-sandbox stay stable. Write `bin/test-jug-filter` (same-seed
      registry parity across modes and days) alongside; Cruisin' bypasses entirely
- [ ] 6.3 Vendor pricing: deduct via scoring, refusal toast when unaffordable, Day 1
      free; HUD juice interactions unchanged in Cruisin'
- [ ] 6.4 Sputter wiring: speed clamp + boost disable in `zerble.js` via runState
      flag, HUD countdown, audio loop, frown-deduction suppression in the crowd
      handler, exit on any `addJuice`
- [ ] 6.5 Vibe wiring — **gated in `main.js`, not on raw `crowd.onZerbleHit`**: vibe
      strike + combo break + Lurleen scare + struck-NPC frown fire only on
      `hit.damaging && !isGod()` (mirror the existing gate at `main.js:1201`;
      `damage: 0` grazes of fleeing NPCs stay consequence-free). Sputter
      frown-suppression (D7) and the vibe frown-strike share ONE trigger condition.
      Persistent ambient vibe-meter HUD widget (always visible in Festival Run,
      alongside the sputter countdown — threshold toasts alone are not feedback);
      frown-threshold ramp multiplier into `crowd.js`; warning whistle + toast;
      ejection death. Comment at the frown dispatch point explaining the
      mode-dependent dual role (dry-tank tax vs vibe feedback)
- [ ] 6.6 Lurleen tow rescue: once-per-run intercept of `ran_dry`, tow beat to
      nearest juice source, soft-lock-safe abort path. **Precondition:** the no-jug
      fallback (design D14: zero registry-resident jugs ⇒ minimal refill, no tow
      animation). Designated FIRST CUT under time pressure — nothing depends on it
      (-> Q3)
- [ ] 6.7 Run end: score screen live (cause, high-water, days, best combo), local
      board insert, `run_end` analytics; day-crossing toasts ("Day 3 — the vendors
      raise their prices…")
- [ ] 6.8 Full-loop playtest via `__dbg` — run the dry-death drill (setJuice(0) →
      sputter → death) as the 6.4 checkpoint BEFORE 6.5 work starts, then the
      ejection drill (scripted damaging hits → warning → ejection, validating the
      corrected gate: god-mode and grazes rack nothing) and the rescue path with
      Lurleen following; screenshots + console clean; backtick budget panel
      unchanged; boot-test `?perf=low`

## 7. P2 docs + ship

- [ ] 7.1 CHANGELOG (P1+P2 entries), ROADMAP: consume "Name entry" item + parked
      "costs smiles" bullet (fix its stale "up to 4 meters" stockpile text); add
      parked "daily-seed challenge mode" follow-up; README/title-card tone check (no
      Easter-egg leakage, calibrated copy intact)
- [ ] 7.2 DEBUGGING.md: new `__dbg` drills (showScoreScreen, runDay, vibe, run-state
      nudges); ARCHITECTURE.md: short "Festival Run layer" section

## 8. Global leaderboard: Worker + client (P3)

- [ ] 8.1 `workers/leaderboard/` (outside game importmaps): Worker per design D8 —
      run/start (HMAC token, optional Turnstile), run/beat (monotonic + smiles/min +
      day-vs-elapsed validation **using the recalibrated D8 ceiling formula** — the
      pre-combo GA4 baseline is forbidden; quarantine ships only against the new
      formula), run/end, board reads (daily/all), quarantine, admin delete;
      `wrangler.toml` + README with deploy steps + secret list for Gary. Descope
      ladder if pressed: HMAC token + monotonic validation never descope; Turnstile
      conditional; quarantine + admin tooling trim first
- [ ] 8.2 Worker unit checks runnable without deploy (plain node test file for
      validation logic: ceilings, monotonicity, name sanitizer) — MUST assert the
      worked example: a legit ×8-multiplied max-rate run passes, an
      implausible-beyond-formula run is rejected
- [ ] 8.3 `leaderboard.js` client: token fetch, 60s + milestone heartbeats, final
      submit, `pagehide` sendBeacon, timeboxed fire-and-forget wrappers, feature flag
      (endpoint unset ⇒ global board off, UI hides tab)
- [ ] 8.4 Score screen global tabs (daily/all-time) with silent local fallback;
      `leaderboard_submit` analytics
- [ ] 8.5 End-to-end vs `wrangler dev` locally (start → beats → kill tab → entry
      stands; implausible submission rejected); document results in session log
- [ ] 8.6 CHANGELOG P3 entry (client + "Worker ready, deploy pending")

## 9. Verify + wrap

- [ ] 9.1 Full smoke: boot main game both modes; **named invariance re-diff**
      (`dumpRegistry` A/B + no-stakes-HUD screenshot — an explicit step, not just
      "boot both modes"); run ALL `bin/test-*` scripts (run-mode, scoring,
      run-state, jug-filter, worker); sandbox spot-checks; `bin/check-importmaps`;
      budget panel; `?perf=low` + `?perf=mid` boots
- [ ] 9.2 `bin/readme-sync festival-run-stakes` + session-log/README final pass;
      queue `/opsx:verify`
