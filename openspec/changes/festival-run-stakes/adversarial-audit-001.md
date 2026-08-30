# Adversarial Audit 001 — festival-run-stakes (+ the three post-wrap commits)

**Auditor**: council-adversary (standalone, Tier 2)
**Date**: 2026-08-30
**Scope**: `openspec/changes/festival-run-stakes/` artifacts + delta specs, cross-referenced
against the shipped code at `vm-main` HEAD = `91b3427`, covering `84422b9..HEAD`:
`14e9512` (review-001 fix pass), `11bbafb` (title-screen redesign), `91b3427` (How-to-play
page swap + boot-gauge start button).
**Prior art honoured**: `reviews/001-groups-6-9/review-summary.md` + `specialist-notes.md`.
Nothing that review found and fixed is re-reported here. This audit hunts what **both** the
`bin/drill-stakes` drills and that review missed.

> **Working-tree caveat — read this first.** While this audit was running, `styles.css` was
> being edited live (mtime 07:14, `git status` shows ` M styles.css`; two untracked
> screenshots `mobile-festival-hud.png`, `mobile-howto.png` appeared). An in-flight mobile
> pass has **already landed** several touch-target fixes (`#howto-open`, `.board-link`,
> `#player-name`, `.settings-trigger` all gained `min-height: 40–42px`) and the status-rail
> `flex-wrap` + `max-width` overflow fix. Findings below are marked **[already fixed
> in-tree]** where that pass covers them. Every CSS line number cites the **current working
> tree**; JS/HTML line numbers cite `91b3427`.

---

## Verdict

**Proceed with mitigations.**

No charter Non-Negotiable is violated. Determinism holds (the jug filter's
`return`-not-`continue` gate at `chunks.js:2143` is genuinely draw-count-neutral and sits
strictly after all `ctx.rng()` draws), the iOS synchronous-gesture chain to `Sound.init()`
survives the new title card (`main.js:690–727` has no `await`/`setTimeout` before the call),
`bin/check-importmaps` passes clean (43 src + 12 worldgen + 28 models across 4 pages), no
`THREE.X = Y`, no new geometry/draws/shadow casters, no lifecycle or `chunkKey` change.

What is wrong is **one shipped gameplay decision that contradicts its own design rationale
once you do the arithmetic**, **one launch-blocking capacity problem in the un-deployed
Worker**, and **a cluster of mobile-layout bugs that are the same bug class review 001 just
fixed, one element deeper** — the fix pass repaired the flagged instances but never swept for
the pattern.

---

## The "Killer" Finding

### A1 — Q6's sputter-frown strike converts the dry-death grace window into a near-certain marshal ejection, and the ejection feedback lies

**Severity: High** (gameplay design contradiction; player-visible; ships in the default
Festival Run experience)

Q6 was resolved by Gary as option (a): "sputtering frowns land the half-weight vibe strike,
no smile tax" (`review-summary.md` Outcome; `main.js:580–583`). The stated rationale in
`14e9512` is that this "gives the grace window a route choice (limp through the crowd =
risky, limp through open ground = safe)". Nobody quantified the frown throughput before
shipping it, and the numbers don't support a *choice* — they support a forced outcome.

The chain, all in current code:

- In Festival Run, `crowd.onFrown` is reachable **only** during sputter (frowns need
  `bubblesEmpty`; dry always implies sputter in an active run — established by review 001).
  So 100 % of Festival frowns now become vibe strikes, with zero rate limiting
  (`main.js:580–583`).
- Frowns are cheap to trigger. `crowd.js:1313` accumulates `1.4 × frownMult × closeness ×
  (0.55 + 0.45·aim)` per second against `FROWN_THRESHOLD = 0.9` (`crowd.js:77`). At a
  middling 9 m / half-aimed approach that is ~1.7 s per NPC on Day 1 and ~1.0 s on Day 5
  (`frownMult` 1.6, `runMode.js:27`). Every distinct NPC inside `SMILE_RANGE = 18 m`
  (`crowd.js:71`) can contribute one.
- Each frown is `VIBE.frownStrike = 0.5` (`runMode.js:47`); decay is `1/15` per second, so a
  full 45 s grace window (`SPUTTER_GRACE_SEC`, `runMode.js:49`) only bleeds off 3.0 strikes
  total.
- Ejection limits were tuned for **collisions** (`hitStrike = 1`): 8 down to 5 as days climb
  (`runMode.js:23–27`). In frown currency that is **10 frowns at Day 5, 14 at Day 3**.

Ten distinct NPCs noticing a dry cart over 45 seconds is not a risk, it is the expected case
anywhere near a hub — and hubs are where the jugs and vendors are, so the player *must* limp
into the crowd. The two-death design collapses: `ran_dry` becomes rare and `vibed_out`
absorbs it.

Worse, the feedback is a lie. The player who has hit nobody gets
`'A marshal blows the whistle — ease up on the crowd!'` (`main.js:1491–1493`) and then
`'The marshals walked you out on Day N…'` (`main.js:1542–1543`) for the crime of running out
of juice. The vibe chip is the D15 "a death path is never invisible" widget; here it fills
from a source the player has no model for.

**Recommendations (pick one):**
1. Rate-limit frown-sourced strikes (e.g. at most one strike per 5 s of sputter, or cap
   total sputter-sourced vibe at ~40 % of `eject`), so the route choice is real rather than
   decorative; **and**
2. give the marshal warning a sputter-specific line ("the marshals notice a dry cart") so
   the whistle stops accusing the player of something they didn't do; **or**
3. revert to option (b) and delete the three knobs, accepting that `frownMult` is cosmetic.

A `bin/drill-stakes` case is cheap here: park a sputtering cart in a seeded crowd, tick 45 s,
assert the run does **not** end `vibed_out` at Day 3. There is currently no drill covering
frown→vibe at all.

---

## Ranked Findings

### A2 — The Worker's KV write budget makes the "free tier" claim false; one client can drain a day's quota in ~4 minutes

**Severity: High** (pre-deployment; the global board dies silently on launch day)

`proposal.md:46` states the Worker is "plain JS on Cloudflare's free tier". Workers KV free
plan allows **1,000 writes/day** and rate-limits writes to a *single key* to ~1/sec.

Per `/run/beat`, `applySubmission` performs: 1 × `run:<id>` put (`worker.js:176`) + 2 × board
puts, one for `board:all` and one for `board:daily:*` (`worker.js:186–192`) + 1 rate-limit
counter put (`worker.js:123`) = **4 writes**, rising to **6 on `/run/end`** with the
verify-and-repair read-back put (`worker.js:197–201`).

- A single 20-minute Festival Run at the 60 s cadence (`leaderboard.js:67`) plus milestone
  beats burns **~90–120 writes**. Roughly **8–10 honest runs exhaust the entire daily
  quota.**
- Availability attack: `/run/beat` is rate-limited at 60/min *per IP* (`worker.js:235`), and
  `/run/start` is unauthenticated with `TURNSTILE_SECRET` optional and failing **open** when
  unset (`worker.js:128`). One token + 60 beats/min × 4 writes = 240 writes/min → the day's
  quota is gone in **~4 minutes**, from one host, with no forgery required.
- `board:all` is a single hot key written on every beat; past ~1 write/sec, KV rejects and
  the unhandled `await put` throws out of `fetch` → 500. The client swallows it
  (`leaderboard.js:87–88`), so the failure mode is **the board silently stops updating** with
  nothing in the game or the logs to say so.

Review 001 flagged `board:all` for *last-write-wins consistency* (P3) and that was accepted;
the **quota/DoS** facet is distinct and unaddressed.

**Recommendation:** stop writing board arrays on every beat. Beats should update
`run:<id>` only (1 write); fold into the boards on `/run/end` and on a coarse milestone
(new day). Drop the per-request rate-limit KV write in favour of Cloudflare's built-in
Rate Limiting binding, or bucket it to 1 write per 10 requests. Re-check the arithmetic
against the free-tier limits **before** `wrangler deploy`, and note the real per-run write
cost in `workers/leaderboard/README.md`. Q4 is still open, so this is free to fix now.

---

### A3 — The mobile beacon listens on the one event iOS doesn't reliably fire, contradicting the P1 it was written to fix

**Severity: High** (the platform Gary named; the fix pass touched this exact function)

Review 001's P1 was: "one mobile backgrounding permanently closes the run server-side… This
is the project's most-cared-about platform." The fix changed the *payload* (`/run/end` →
`/run/beat`) but left the *event* alone: `leaderboard.js:97` hooks **`pagehide` only**.

On iOS Safari, app-switch / lock / tab-eviction does not reliably fire `pagehide`;
`visibilitychange → hidden` is the last dependable callback. The codebase already knows this
— `main.js:821` carries the comment "`beforeunload` is flaky on mobile" and `main.js:831–835`
hooks **both** `visibilitychange` and `pagehide` for `session_end`, and `analytics.js:230`
repeats the reasoning. The new leaderboard beacon, shipped in the same change, did not adopt
the house pattern.

Net effect: the guarantee the P1 fix was written to deliver ("a killed tab still records")
is the one that still doesn't hold on iOS. The score freezes at the last 60 s heartbeat.

**Fix:** mirror `main.js:831–835` — beacon on `visibilitychange && document.hidden` as well
as `pagehide`, guarded against double-send (the Worker upsert by `runId` is idempotent, so a
duplicate beat is harmless).

---

### A4 — The cycle-chip fix from review 001 was applied to the desktop rule only; the ≤600 px override re-creates the squash in Festival Run on every phone

**Severity: Medium-High** (mobile; the flagship new HUD element; never screenshotted at phone
width in Festival mode)

The P1 fix made the chip content-sized: `.cycle-status { min-width: 42px }` +
`.cycle-dial { flex: 0 0 auto }` (`styles.css:268–288`), with the comment explaining that the
day label "widens the chip when shown."

The mobile block was not updated. `styles.css:1432–1435` still pins
`.cycle-status, .lurleen-status { width: 36px }`, and `styles.css:1437–1440` shrinks the dial
to 28 px. Because `min-width: 42px` from the base rule survives and flex items don't grow
(`flex-grow: 0`), the chip is hard-clamped at **42 px** while its Festival Run content needs
~73 px (28 px dial + 5 px margin + a `white-space: nowrap` "Day 3" ≈ 40 px at 11 px/800,
`styles.css:718–723`). `.hud-chip` has no `overflow`, so the content spills outside the pill
on both sides and collides with the neighbouring chip at the 4 px mobile gap.

The re-verification line in the review Outcome — "both modes re-screenshot — Cruisin' dial
31×31" — is a **desktop** measurement (31 px is the desktop dial; mobile is 28 px), so this
was never checked at phone width.

**Fix:** in the ≤600 px block, replace `width: 36px` on `.cycle-status` with
`min-width: 36px` (leave `.lurleen-status` fixed — it has no conditional child), and
re-screenshot the mobile HUD in **Festival Run**, not just Cruisin'.

---

### A5 — `.combo-heart.hidden` was left out of the `display: none` sweep, and it is what pushes the mobile status rail into a second row

**Severity: Medium** (mobile layout; same bug class as the P1 the fix pass closed)

The fix pass added a `display: none` list for stakes-only chips —
`.day-n, .sputter-count, .vibe-status, .combo-status, .board-tabs`
(`styles.css:732–738`) — with a comment explaining precisely why visibility-hiding reserves
layout. It missed the ♥×2 badge nested one level deeper: `#combo-heart` is toggled with the
fade-`.hidden` class (`index.html:158`, `hud.js:268`) and `.combo-heart`
(`styles.css:800`) is not in that list.

Consequence: for the entire Festival Run *except* while Lurleen follows, the combo chip
carries an invisible ~26 px "♥×2" plus the 6 px `.combo-status` gap — **~32 px of dead
width** in a chip that is otherwise 26 px.

That 32 px is load-bearing. At 375 px the rail budget is
`max-width: calc(100vw - 44px)` = 331 px (`styles.css:68`), and the Festival chip row with a
short score totals ≈ 358 px **with** the phantom heart versus ≈ 326 px without — i.e. the
invisible badge is what tips the rail over the wrap threshold. `mobile-festival-hud.png`
(untracked, captured during the in-flight pass) shows exactly that: the vibe meter alone on a
wrapped second row.

**Fix:** add `.combo-heart.hidden` to the `display: none` list. Also sweep the same pattern
on the score screen — `hud.js:331–334` toggles `.hidden` on `#score-stats`, `#score-again`
and `.board-title` for the title-card "Local legends" peek, and none of those three are in
the list either, so the view-only board renders with ~110 px of invisible reserved space
(dead stats block + dead button row). `#board-empty` (`hud.js:139`) has the same shape.

---

### A6 — The wrapped status rail now collides with the toast, and the marshal warning covers the meter it is warning about

**Severity: Medium** (mobile; emergent from A5 + the in-flight wrap fix)

`#toast` sits at `top: calc(58px + safe-area)` at ≤600 px (`styles.css:1456`) with
`max-width: calc(100vw - 24px)` — a near-full-width centred pill. The newly-wrapped second
chip row occupies roughly y = 50–86 px (8 px rail top + 36 px row + 6 px `row-gap` + 36 px).
They overlap, and the toast has an opaque-ish background plus `backdrop-filter: blur(6px)`
(`styles.css:398–414`).

The second row is where the **vibe meter** lands (see `mobile-festival-hud.png`). So the
"A marshal blows the whistle — ease up on the crowd!" toast (`main.js:1491–1493`) and the
day-up toast (`main.js:984`) both draw over the vibe meter at the exact moment the player is
being told to watch it. This is a new collision: the rail only wraps because Festival Run
added chips.

**Fix:** push the mobile toast below the wrapped rail (`top: calc(96px + safe-area)` when the
rail can wrap), or give the toast a max-width that clears the rail, or move the toast to the
bottom third on ≤600 px.

---

### A7 — `#howto-back` is a ~28 px tap target and is the only way off the How-to page on a phone

**Severity: Medium** (mobile; the one target the in-flight pass missed)

The in-flight mobile pass gave `min-height: 40–42px` to `#howto-open`, `.board-link`,
`#player-name` and `.settings-trigger`. It did not touch `#howto-back`
(`styles.css:632–646`): 9 px `Press Start 2P` + `padding: 8px 12px` ≈ **28 px tall**, well
under the 44 px iOS / 48 dp Android floor.

That matters more than the others because the page swap sets `#title-page-main` to `hidden`
with `.card-page[hidden] { display: none !important }` (`styles.css:589`), so on a touch
device **Back is the only exit** — the Escape fallback (`hud.js:94–96`) needs a keyboard.
`mobile-howto.png` shows how small it renders.

Two more in the same class, also untouched:

- `.mode-btn` (`styles.css:814–828`) is fine at ~44–50 px normally, but under
  `@media (max-height: 560px)` — i.e. **any landscape phone** — `.mode-desc` is
  `display: none` and padding drops to `4px 12px`, giving **~24 px rows separated by a 2 px
  `gap`** (`styles.css:805–812`). Two 24 px targets 2 px apart, where a mis-tap picks the
  mode that can kill your cart, is the exact hazard D13 was written to prevent.
- `.board-tab` (`styles.css:963–974`): 12 px font + 4 px padding ≈ **22 px**. Only visible
  once the global board is deployed, so it is free to fix now.
- `.score-actions button` (`styles.css:1005–1013`): ~36 px — the death screen's primary
  action, below the floor.

---

### A8 — The score screen is the only overlay still measured in `vh`, on the platform where `vh` lies

**Severity: Medium** (mobile; the death/payoff screen)

`body` uses the `100vh` → `100dvh` progressive pair (`styles.css:21–22`), `#title-card`
scales entirely in `dvh` with a documented "FIT ANY SCREEN" contract
(`styles.css:468–505`), and `.settings-card` uses `max-height: calc(100dvh - 40px)`
(`styles.css:1494`). `#score-screen .card` is the outlier:
`width: min(440px, calc(100vw - 40px)); max-height: calc(100vh - 60px)` (`styles.css:912–913`).

With the iOS URL bar expanded, `100vh` exceeds the visible viewport by ~60–100 px. The
overlay is `display: flex; align-items: center` with no `overflow-y` of its own
(`styles.css:900–908`), so an over-tall card overflows symmetrically and unreachably — the
same flex-centring trap `#title-card` explicitly documents and works around with
`margin: auto` + `overflow-y: auto` (`styles.css:470–471`, `497`, `500`). With a full ten-row
board plus tabs, the "Run it again!" row is the part that goes under the toolbar.

The score card also has no `env(safe-area-inset-*)` and no short-viewport media query, unlike
the title card (`styles.css:1345–1370`).

**Fix:** `100vh` → `100dvh`, `100vw` → `100dvw`, and adopt the title card's
`margin: auto` + overlay `overflow-y: auto` shape.

---

### A9 — Google Fonts is a new render-blocking third-party request in production, and a privacy regression

**Severity: Medium** (production; added by `11bbafb`)

`index.html:65–67` adds two `preconnect`s and a **render-blocking** stylesheet link to
`fonts.googleapis.com` for `Press Start 2P`, ahead of `styles.css`.

- **Blocking:** first paint of the title card now waits on two extra RTTs (googleapis CSS,
  then gstatic WOFF2) on cellular. This lands on top of a boot that already needs the whole
  ~70-module graph plus three.js from unpkg — the reason the boot gauge exists at all.
- **Privacy:** hotlinked Google Fonts transmits every visitor's IP to Google before any
  interaction. This project is otherwise careful here — GA4 is host-gated (`index.html:9–32`)
  and the player's name is deliberately kept out of GA4 (`main.js:715–718`,
  `specs/player-identity/spec.md`). Serving the WOFF2 from the repo (it is a ~10 KB
  single-weight pixel font) restores that posture, removes the render block, and keeps the
  "open index.html and it just works" property.
- **Layout shift:** `display=swap` with a fallback of `'Courier New', ui-monospace,
  monospace` (`styles.css:474–476`). Press Start 2P is roughly a 1.0 em advance versus
  Courier's ~0.6, so "ZERBLE" at 34 px renders ~135 px in fallback and ~216 px once the font
  lands — a visible ~60 % reflow of the marquee, the mode names and every pixel-font label on
  the title card, in the same window where the player is aiming at a mode row.

---

### A10 — `withName` ships six call sites at 0.4–0.6 against a spec that says 0.25 is the ceiling

**Severity: Low** (contract drift; decide which side is wrong)

`specs/player-identity/spec.md` — "Name-bearing variants SHALL appear occasionally (roughly
1-in-4 of eligible toasts **at most**)". The helper defaults to `chance = 0.25`
(`hud.js:358`), but six call sites override it upward: `main.js:815` (0.5), `996` (0.5),
`1061` (0.5), `1493` (0.4), `1507` (0.5), `1583` (0.6).

All six are rare one-shot beats (intro, sputter start, found Lurleen, marshal whistle,
Lurleen heartbreak, rescue), so the *saturation* intent is arguably honoured — but the spec
states a per-toast cap and the code exceeds it by up to 2.4×. Either soften the spec sentence
to "sprinkled, with per-event tuning" or bring the six call sites under 0.25. A spec that
nobody follows is worse than no spec.

---

### A11 — Cross-run (not cross-mode) score carry: a dead run's `highWater` survives a Settings-Apply reload

**Severity: Low** (narrow reachability; worth a two-line guard)

The P0 fix gates the resume payload on **mode** match (`main.js:560–567`) and correctly nulls
the run block after death (`main.js:669`, `run: RunState.over ? null : RunState.serialize()`).
But `scoring` is still serialized unconditionally, so a post-death snapshot carries the dead
run's `highWater`; `applyResumeGameState` restores it, then `RunState.begin()` starts a
*fresh* run on top of it (`main.js:698`). The next death would submit the previous run's peak.

Reachability today is low: `#settings-gear` is z-index 16 under the z-index 22 score screen
(`styles.css:900`, `1372`), and both score-screen buttons `location.reload()`
(`main.js:1552–1553`), which clears the one-shot snapshot. But `running` stays `true` after
death (`captureState` at `main.js:666` still returns a payload), so the guard is
circumstantial rather than structural.

**Fix:** make it structural — `scoring: RunState.over ? null : Scoring.serialize()`, matching
the `run` field one line below.

### A12 — Small stuff worth one line each

- **Backtick opens the debug overlay from inside the name field.** `debug.js:1000` and
  `debug.js:1007` both guard `KeyT`/`KeyK` with `!e.target.matches('input, textarea, select')`;
  the `Backquote` branch at `debug.js:995` has no such guard. A player typing a backtick into
  the new name input reveals the perf overlay (charter Non-Negotiable #9 — Easter eggs stay
  discovered, not handed over). `input.js:31` gets this right; copy that guard.
- **Boot failure is a permanent, cheerful lie.** The start button only enables from
  `HUD.onStart` (`hud.js:227–239`). If unpkg is blocked or a module 404s, the boot narration
  (`index.html:316–350`) rotates "Pressurizing the bubble tank…" forever with no error path.
  A 15 s fallback ("Something's stuck — try reloading?") turns a dead page into a recoverable
  one.
- **Sputter countdown squeezes the juice bar it lives inside.** At ≤600 px `#juice-meter` is
  a fixed 100 px (`styles.css:1420–1424`) and `.juice-track` is `flex: 1`
  (`styles.css:232–239`), so the "45s" span shrinks the working juice bar from ~68 px to
  ~39 px at the exact moment the player is watching it. Consider widening the chip while
  sputtering rather than eating the gauge.
- **`bin/drill-stakes` is not in `npm run check`.** The review's own permanent regression
  drill (17/17) is absent from the `check` script in `package.json`; the 15 node gates are
  there but the drill that covers both P0 blind spots is not. If it needs a browser, say so
  in `DEBUGGING.md`; otherwise wire it in.
- **Worker orphan runs.** With the beacon now sending beats instead of ends (correctly), runs
  are rarely marked `done`; `run:<id>` records live out the full 48 h TTL (`worker.js:36`).
  Harmless for storage, but it means `finished_run` rejection (`worker.js:152`) almost never
  fires, so a run token stays replayable for two days.

---

## Checked and Clean (so the next auditor doesn't re-walk these)

- **Determinism (Non-Negotiable #1):** `jugKeptAt` gates only the final
  build/add/register triplet, after every `ctx.rng()` draw, with `return` not `continue`
  (`chunks.js:2143–2155`); `_jugKeepFraction` defaults to 1.0 so hub-sandbox and map-sandbox
  are untouched (`runMode.js:58`); Cruisin' never calls the setter. No `Math.random()` in a
  seeded path (`hud.js:359`, `main.js:983`, `main.js:1570` are all runtime-only).
- **iOS audio (Non-Negotiable #3):** `main.js:690–727` — `captureName()`,
  `Scoring.configure`, `applyResumeGameState`, `RunState.begin`, `setJugKeepFraction`,
  `Analytics.*`, and the unawaited `Leaderboard` kick are all synchronous ahead of
  `Sound.init()`; `Sound.startSputterLoop()` is correctly placed *after* it.
- **Importmaps (Non-Negotiable #4):** `bin/check-importmaps` exits 0 — 43 src + 12 worldgen
  + 28 models across all four pages; `workers/` correctly absent.
- **Perf budgets (#6):** no `THREE.*`, no material/geometry/light/`castShadow` in the whole
  post-wrap diff. DOM writes stay dirty-flagged (`hud.js:246–323`).
- **Cross-mode resume (the two P0s):** genuinely closed in both directions — Festival
  snapshot + Cruisin' start restores nothing (`main.js:561`), Cruisin' snapshot + Festival
  start begins at zero, and the frame gate carries the belt-and-suspenders
  `RunMode.isFestival()` (`main.js:980`).
- **Touch-list swap on the How-to page:** correct, and correct *before first paint* —
  `@media (pointer: coarse)` at `styles.css:1157–1160` resolves the same signal as
  `Touch.isTouchDevice()` ahead of the JS class, with a comment explaining exactly why.
  `mobile-howto.png` confirms the touch list renders on a phone. `Touch.install()` also runs
  at module load (`main.js:627`), not at Start, so `body.is-touch` is set before the card is
  interactive.
- **Name input vs. game keys:** `input.js:27–31` and `debug.js:1000/1007` guard editable
  targets, so typing a name can't drive the cart or trip the `t` menu (only the backtick gap
  in A12 remains).
- **`?bootDelay` leakage:** host-gated to local/preview and clamped to 10 s
  (`index.html:123–127`) — no player-facing path.
- **Board XSS:** every board cell goes through `textContent` (`hud.js:149–154`) and both
  client and Worker sanitize names (`leaderboard.js:23–30`, `worker.js:59–69`); the Worker's
  charset filter excludes `\p{Cf}`, so no RTL-override or combining-mark names.
- **`savesPersonalBest`:** honoured — `zerble-best-smiles` is written only under the mode gate
  (`main.js:1034`, `main.js:1950`), so Festival scores never pollute the Cruisin' best.
- **Mode-flip race at boot:** `index.html:224` hard-codes Cruisin' as checked, and
  `reflectMode()` corrects it at module load — but because Start stays disabled until
  `HUD.onStart` (after module load), a returning Festival player can never start in the wrong
  mode. The boot gauge accidentally guards this; worth keeping in mind if the gating ever
  relaxes.

---

## Recommended Next Step (one question for Gary)

**A1 needs your design call before anything else ships.** Everything else on this list is
mechanical. The question is:

> When Zerble runs dry inside a hub crowd on Day 3+, should the frown cascade be *able* to
> eject you before the 45-second grace expires — i.e. should `vibed_out` be the usual outcome
> of running dry near people? If yes, the marshal copy needs a sputter-specific line so the
> feedback stops accusing the player of hitting the crowd. If no, frown-sourced strikes need
> a cooldown or a per-sputter cap (and a drill that asserts it).

After that, the cheap batch, in order: A3 (add `visibilitychange` to the beacon), A2 (cut the
per-beat board writes before deploying), A5 + A4 + A6 (the mobile chip sweep), A7 (the
`#howto-back` / landscape `.mode-btn` targets), A8, A9, A11.


---

## Outcome (2026-08-30, same-day fix pass)

All findings addressed: A1 governed (addSputterStrike: 4s cooldown, 40%-of-eject
cap, per-grace-window reset, honest sputter whistle copy; invariants in
bin/test-run-state — sputter frowns can never eject alone, hits still can), A2
(cadence + no-change + fold gates, per-run write cap, per-beat KV rate-limit
WRITE removed as self-defeating; write-count asserts in the worker test), A3
(visibilitychange + pagehide, burst-throttled), A4/A5/A6/A7/A8 (CSS: min-width
cycle chip, combo-heart sweep, toast clears the wrapped rail, howto-back +
landscape rows ≥38px, dvh score screen), A9 (font vendored: 6.7KB OFL woff2,
zero third-party CSS), A10 (spec softened to per-event tuning), A11 (post-death
snapshot nulls score AND scoring), A12 (backquote input guard, 20s boot-failure
line, sputter chip widens instead of eating the juice track, drill:stakes
alias, orphan note). The mobile tap-target/rail items were fixed in the
parallel touch-profile pass (commit ca1210f). One bonus regression found by
the e2e battery during verification: a death outracing the /run/start token
lost its final — finals now queue and flush on token arrival.
Re-verified: npm run check 16 gates, mobile-emu 12/12, drill-stakes 17/17,
global e2e 12/12, title fit battery all sizes/pages.
