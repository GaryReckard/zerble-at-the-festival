# Proposal: festival-run-stakes

## Why

Zerble is an impressive festival sandbox with no stakes: smiles accumulate forever, there is no way to win or lose, and nothing asks the player to come back. Gary wants real gamification — arcade-style stakes, a leaderboard with the player's name on it, and the tension that makes "one more run" a thing. The 2026-08-28 brainstorm (Gary + agent; captured in the auto-memory `festival-run-stakes-design.md` and this change's design.md) settled the shape: an endless-until-death **Festival Run** mode layered *alongside* the existing chill game, never replacing it.

## What Changes

- **Name entry on the title card.** "What's your name?" field, persisted to `localStorage`. Toasts occasionally use the name. **No arch greeting** (Gary explicitly cut that half of the ROADMAP item). GA4 never receives the name — only `name_entered` / `name_length` (ROADMAP privacy line stands).
- **Mode split.** Title card offers **Festival Run** (stakes + leaderboard) and **Just Cruisin'** (today's game, byte-for-byte: free vendors, unlimited jugs, no death). All stakes tuning is mode-scoped config; global constants like `JUICE_STACK_MAX = Infinity` are untouched.
- **Festival Run: endless with a day-ramp.** Each 6-minute day tightens the screws (vendor smile-prices rise, effective jug availability drops, crowd frowns easier, marshals stricter) so death is statistically inevitable without being scheduled. Day counter is a secondary brag stat.
- **Two deaths:** fully dry (sputter/limp grace window, then Zerble conks out) and vibe-out (hits/frowns fill a rolling meter; marshal warning ladder, then ejected). Frowns change jobs: from dry-tank tax to the feedback face of the vibe system.
- **Chain combo + Lurleen ×2.** Rapid smile collection builds a visible multiplier (draining-ring badge); frowns/hits break it; star power maxes it. Lurleen following = flat ×2 on top (♥×2); hitting an NPC scares her off. Combo counts smiles *however earned* — no hidden variety rules (Gary tabled that).
- **Smile-collection SFX.** Currently silent. Pentatonic pitch-ladder blip (each rapid smile steps up, lull resets) = audible combo feedback. Voice-capped, detuned, on the SFX bus. Frown gets a soft down-note.
- **Quests tie-in (forward-compatible only).** Passenger quests are a separate future change, but the scoring/juice interfaces here must accept "smile burst + juice tip" payments.
- **Local leaderboard.** Top-10 runs (name, score, days, date) in `localStorage`, shown on the score screen; extends the existing `zerble-best-smiles` pattern.
- **Global leaderboard via Cloudflare Worker.** `/run/start` token → ~60s heartbeats + milestone updates → final submit (+ `sendBeacon` on pagehide). High-water-mark scoring. Server-side plausibility checks, rate limits, Turnstile, profanity filter, outlier quarantine, admin delete, daily + all-time boards. Worker code ships in-repo (`workers/leaderboard/`); **deployment is gated on Gary** (account, secrets).

## Capabilities

### New Capabilities
- `player-identity`: name capture, persistence, in-copy usage rules, and the GA4 privacy boundary.
- `game-modes`: the Festival Run / Just Cruisin' split, mode selection UX, and the mode-scoped-tuning contract ("Cruisin' is invariant").
- `festival-run`: the run lifecycle — day ramp, juice economy (vendor pricing, sputter state), vibe meter + marshal ladder, deaths, Lurleen tow rescue, run summary.
- `scoring`: smiles-as-score, chain combo, Lurleen ×2 stacking, high-water-mark recording, combo feedback contract (HUD badge + pitch ladder).
- `leaderboard`: local top-10 board; global board client protocol (token, heartbeat, submit) and Worker-side guardrails.

### Modified Capabilities
- `hud`: title card gains name field + mode select; in-game HUD gains combo badge, day counter, vibe warnings; new score screen.
- `feedback-systems`: smile collection emits a collect event (hook for SFX + combo); juice economy becomes mode-aware.
- `crowd-ai`: NPC hits can trigger frowns (vibe source); frown threshold becomes ramp-adjustable; dry-tank frowns demoted to flavor during sputter.
- `carts`: Lurleen gains multiplier-follow contract, scared-off-on-hit, and the once-per-run tow rescue.
- `audio-synthesis`: smile pitch-ladder + frown down-note + sputter/marshal/death cues, all inside the existing bus graph and iOS unlock rules.
- `analytics`: run lifecycle events (`run_start`, `run_end` with cause/score/days, `leaderboard_submit`) — never the name.

## Impact

- **Subsystems:** HUD/title card (`hud.js`, `index.html`), core loop (`main.js`), bubbles/juice (`bubbles.js`), crowd (`crowd.js`), Lurleen (`lurleen.js`), audio (`sound.js`), analytics (`analytics.js`), plus new modules (mode config, run state, combo, leaderboard client) and the out-of-app Worker (`workers/leaderboard/` — not part of the game's importmap or perf surface).
- **Tripwires brushed:**
  - **iOS audio init** — the name field lives on the title card; the start-button tap must still call `Sound.init()` synchronously (read the field value, no async hop).
  - **Determinism** — jug availability tuning must NOT reorder or re-salt existing seeded streams; Festival Run applies availability as a runtime filter over generated entries (Cruisin' sees today's world unchanged).
  - **Importmap coverage** — every new `src/` module goes into the three full pages' importmap arrays (`index.html`, `sandbox.html`, `hub-sandbox.html`; `map-sandbox.html` is worldgen-only); `bin/check-importmaps` is the guard.
  - **Perf budgets** — additions are DOM/HUD + Web Audio + game-state only; no new geometry, materials, or draws. No threeShim contact.
  - **Chunk/lake lifecycle** — untouched; no new registry entry kinds in this change.
- **Player-visible:** very — CHANGELOG required (per phase that ships), ROADMAP "Name entry" item consumed, "costs smiles economy" parked bullet consumed, daily-seed mode added as parked follow-up.
- **Dependencies:** none new in the game (no-build stance intact). The Worker is plain JS on Cloudflare's free tier, deployed with `wrangler` — outside the game's runtime entirely.

## Scope Check

- **Toast banks:** name-weaving touches the existing toast call sites in `main.js` (juice, collision, wook, milestone banks) — included, via a single format helper, not per-bank forks.
- **Score write paths:** all smile mutations flow through `main.js` (`score += n` at the collect callback, `onFrown` decrement, `__dbg.addSmiles`) — all routed through the new scoring module so combo/high-water can't drift; verified no other writers via `rg 'score'` sweep.
- **Persistence keys:** existing `localStorage` uses (`zerble-best-smiles` in `hud.js`, settings) surveyed; new keys follow the same `zerble-` prefix; sessionStorage resume snapshot (`main.js`) must additionally carry run state — included.
- **Mode gating parallels:** every stakes behavior (vendor price, dry death, vibe meter, combo) reads one mode-config object rather than scattering `if (mode === ...)` — the config is the single choke point, mirroring how `PERF` tiers gate features today.
- **Excluded:** passenger quests (own ROADMAP item + design doc; only the payment *interface* is honored here), bubble varieties, daily-seed mode (parked to ROADMAP), Festival Passport, hub identities, world events (Locke's issue #1 — triaged separately).
