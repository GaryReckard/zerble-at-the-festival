# Festival Passport

[Documentation index](README.md) · [Player guide](../README.md) · [Verification](../verification/passport/2026-10-25/README.md)

The title-menu link, in-game book button and `P` open a read-only record of this visit and all-time memories. Gameplay pauses while it is open, including movement, pickups, juice consumption, collisions and Festival Run clocks. Closing clears held keyboard and touch actions, restores focus and resumes without catching up elapsed wall time.

## Measurements and persistence

| Statistic | Definition |
| --- | --- |
| From the entrance | Current straight-line x/z distance from the original generated starting position; shown for this visit only. |
| Farthest adventure | Greatest eligible straight-line x/z distance reached in a visit, plus the all-time record. Returning does not lower it. |
| Distance driven | Sum of actual planar displacement inside the cart movement step. Vertical elevation, collision resolution, rescue relocation and debug jumps add no distance. |
| Smiles collected | Pickups before score multipliers, spending and damage deductions. This differs intentionally from the HUD score. |
| Bubbles blown | Successfully initialized ordinary, special and unlock-burst particles. Pool-exhausted attempts and invalid types do not count. |
| Stages visited | In-radius observations using the existing challenge radius, deduplicated by world seed and rounded stage coordinates. The same seeded stage counts once all-time; visiting it in a later visit still counts for that visit. |
| Passengers welcomed | Accepted Zerble boarding callbacks, including a repeat boarding by the same NPC. |
| Bonks | Damaging collisions accepted by the existing gameplay damage gate, not every overlap or stationary brush. |
| Time at the festival | Eligible simulation seconds, displayed in seconds/minutes/hours. Hidden-tab, intro, capture-lock, passport and game-over time is excluded. |

The versioned `zerble.passport` localStorage record contains all-time totals, stage keys and earned stamps. It imports the existing lifetime smile total once, without inventing historical distances, stages or analytics. Bubble upgrades keep their existing progress owner. New counters begin with this feature, and future accepted observations feed the passport directly rather than deriving totals from score or visual particle counts. Saves happen every ten eligible simulation seconds, immediately on a stamp, on settings restart and when leaving the page. A sudden crash can lose the most recent unsaved interval. A storage failure is shown in the passport and leaves in-memory statistics working.

An ordinary reload starts a new visit. The settings **Restart now** path preserves the original entrance, visit counters, stage deduplication and relocation eligibility through its existing sessionStorage resume channel. Restoring a visit never adds those counters to lifetime totals again. Passport continuity is independent of selected mode, while existing score/run mode guards remain intact; a completed run does not resume its visit.

External movement greater than two metres between physics samples, an implausible jump inside a movement step, or an explicitly marked rescue/debug teleport makes exploration records, exploration stamps and new stage discoveries ineligible for the rest of that visit. Current physical distance, later actual driving and the other counters remain available. A new visit restores eligibility. This conservative policy prevents a remote jump followed by a tiny legitimate movement from earning a false record. Ordinary small collision corrections are tolerated.

Progress belongs to this browser and origin. Clearing site data clears it; another device or browser has its own record. It is a personal record rather than an authoritative server score. Concurrent tabs share one save key without merging independent writes, so use one active game tab for a consistent local record.

## Permanent stamps

| Stamp | Criterion |
| --- | --- |
| Wanderer | Reach 500 m from the entrance during an eligible visit. |
| There and Back | Reach 500 m, then return within 25 m of that entrance in the same eligible visit. |
| Stage Hopper | Visit three distinct stages in one eligible visit. |
| Night Owl | Be within a stage's visit radius while nightness exceeds 0.5. A daytime stage can count when revisited after dark. |
| Smile Spreader | Collect 1,000 lifetime raw smiles. Imported history counts toward the threshold, but a subsequent accepted pickup triggers the stamp. |
| Bubble Maker | Successfully emit 1,000 lifetime bubbles. |

Stamps are saved once, have readable criteria before they are earned and confer no gameplay powers. Bonks have no achievement reward. Bubble powers and their toggles remain in Bubble Upgrades.

## GA4 projection

All calls use `src/analytics.js`; an absent or throwing GA tag never affects progression. The existing local-host gate prevents development traffic reaching the production property. No passport event contains names, coordinates, seeds, stage identities or persistent player identifiers. `visit_id` is a new opaque join key for each visit, retained across settings restart, and does not change the world's random stream. GA's existing visitor/session handling remains separate.

`passport_progress` is attempted every 60 eligible simulation seconds and on tab/page hide, settings restart or Festival Run end. These are consumed local checkpoints, not delivery acknowledgements: failed/blocked sends are not replayed later, and progress never waits for GA. Settings capture consumes pending telemetry before serializing, so the ensuing hide cannot duplicate it. Imported history does not enter the telemetry baseline.

| Event parameter | Meaning / reporting |
| --- | --- |
| `active_s_delta` | New eligible play seconds since the previous checkpoint; additive. |
| `distance_m_delta` | Newly driven planar metres; additive. |
| `smiles_delta`, `bubbles_delta` | New raw pickups and successful emissions; additive. |
| `bonks_delta`, `passengers_delta` | New damaging collisions and boarding events; additive. |
| `stages_delta` | New distinct stages during this visit, including previously known all-time stages; additive across reports. |
| `current_distance_m` | Physical radius at the checkpoint; a gauge, never an additive total. |
| `max_distance_m` | Eligible maximum radius during this visit; a gauge, never an additive total. |
| `exploration_eligible` | Whether the visit can still promote exploration records/discoveries. |
| `mode`, `reason`, `visit_id` | Current play mode, `interval`/`hide`/`restart`/`run_end`, and per-visit join key. |

`passport_stamp` contains a whitelisted `stamp` ID, `mode`, `visit_id` and `time_in_run_s`. It fires on a newly earned local stamp, regardless of whether transport succeeds. `feature_used` with `feature=festival_passport` observes opening the menu through the existing feature taxonomy.

### Property setup

The code emits events; it does not configure the GA property. An administrator can register the additive numeric parameters as event-scoped custom metrics and `mode`, `reason`, `stamp` and `exploration_eligible` as event-scoped custom dimensions. Google documents [custom metric creation](https://support.google.com/analytics/answer/14239619?hl=en) and [custom definitions](https://support.google.com/analytics/answer/14240153?hl=en). Existing definitions can be reused where they already cover the same parameter.

Do not sum current/max radius snapshots or register `visit_id` as a report dimension. For visit-level radius distributions in an event export, group by `visit_id`, take the maximum `max_distance_m`, and select the latest checkpoint for the final physical radius. A hide can happen repeatedly within one visit. `reason=hide` does not prove the visit ended, and a missing last checkpoint does not prove zero exploration. Interval averages describe checkpoint samples rather than an unbiased average player.

## Inspection and verification

Run the loopback no-cache server, then open `passport-preview.html?case=populated&mute=1`. The `empty`, `populated`, `migrated`, `long` and `blocked` fixtures instantiate the production menu with injected memory, no GA and no WebGL. The preview is deliberately not a LAN-served public page, while `passport.css` is allowed for actual LAN players.

In a local live game, `__dbg.passport()` returns a detached snapshot and `__dbg.passport(true)` opens the actual menu. Prefer the real title/book/P controls for interaction verification. Run `node bin/test-player-stats`, `node bin/test-passport-integration`, and the required `npm run check`; see the linked verification record for browser evidence and limitations.
