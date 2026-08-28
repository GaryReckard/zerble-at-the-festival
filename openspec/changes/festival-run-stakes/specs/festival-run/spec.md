# festival-run — delta

## ADDED Requirements

### Requirement: Endless run with a per-day difficulty ramp

A Festival Run SHALL be endless-until-death. Each completed day/night cycle (6 real
minutes) SHALL increment a day counter and apply that day's ramp values from the mode
config: vendor refill price (in smiles), scattered-jug availability multiplier, crowd
frown-threshold scale, and vibe-meter strictness. Day 1 SHALL play tutorial-soft
(vendor refills free, availability ≈ today's). Ramp values SHALL come from a single
per-day table so tuning is one edit.

#### Scenario: Dawn raises the stakes

- **WHEN** the cycle crosses into a new day during a run
- **THEN** the day counter increments and that day's ramp row takes effect immediately

### Requirement: Jug availability is a runtime filter, never a seed change

Festival Run jug scarcity SHALL be applied by filtering already-generated jug
entries (deterministically, keyed off the entry's world position + a fresh
run-independent salt). The filter SHALL apply only to the ambient per-chunk jug
scatter — the guaranteed intro-ring jugs at world spawn are exempt (Day 1 stays
tutorial-soft) — and SHALL gate only the final build/add step after all seeded rng
draws for that jug complete, preserving rng draw-count parity for downstream
scatters. Seeded worldgen streams MUST NOT be reordered, re-salted, or made
mode-dependent; Just Cruisin', both sandboxes, and existing players' worlds are
byte-identical.

#### Scenario: Cruisin' world is untouched by scarcity

- **WHEN** the same seed is loaded in both modes
- **THEN** chunk generation output is identical, and only Festival Run hides a
  deterministic subset of jug pickups per the day's availability

### Requirement: Vendor refills cost smiles in Festival Run

From Day 2 onward, drawing juice from a bubble vendor SHALL deduct smiles at the
current day's rate (deducted from current score, never below zero; high-water mark
unaffected). When the player cannot afford a refill, the vendor SHALL refuse with a
distinct toast. Day 1 vendor refills SHALL remain free.

#### Scenario: Refueling spends score

- **WHEN** a Day 3 player with 120 smiles draws a full vendor refill priced at 20
- **THEN** current score drops to 100 and the high-water mark stays unchanged

#### Scenario: Broke players are refused

- **WHEN** a player with fewer smiles than the refill price enters a vendor's range
- **THEN** no juice flows and a "can't afford" toast explains why

### Requirement: Running fully dry starts a sputter grace, then death

When juice reaches zero in Festival Run, Zerble SHALL enter a **sputter** state: max
speed limited to a crawl, boost disabled, sputtering SFX, and a visible grace timer
(≈45s). Collecting any juice SHALL exit sputter and restore normal driving. If the
grace expires, the run SHALL end with cause `ran_dry`. During sputter, NPC frowns
SHALL be flavor-only (no smile deduction).

#### Scenario: A jug saves a sputtering cart

- **WHEN** a sputtering player reaches a jug before the grace timer expires
- **THEN** sputter ends and normal driving resumes with no run-ending consequence

#### Scenario: The grace runs out

- **WHEN** the sputter timer expires with no juice collected
- **THEN** the run ends with cause `ran_dry` and the score screen appears

### Requirement: Vibe meter with a marshal warning ladder

Damaging NPC hits (and the frowns they cause) SHALL feed a rolling vibe meter that
decays over time. Crossing the warning threshold SHALL fire a marshal whistle + toast;
crossing the ejection threshold SHALL end the run with cause `vibed_out`. Knocking
over props/scenery MUST NOT feed the meter (people bad, mess funny). Thresholds
tighten with the day ramp.

#### Scenario: A warning precedes ejection

- **WHEN** the vibe meter crosses the warning threshold
- **THEN** the player receives a whistle + toast before any ejection can occur

#### Scenario: Ejection ends the run

- **WHEN** the vibe meter crosses the ejection threshold
- **THEN** the run ends with cause `vibed_out` and the score screen appears

### Requirement: Lurleen tow rescue, once per run

The first time a run would end via `ran_dry` while Lurleen is in her `following`
state, she SHALL instead tow Zerble to the nearest juice source (teleport-adjacent
staging is acceptable), grant a minimal refill, and consume the run's single rescue.
If no juice source is registry-resident when the rescue fires, she SHALL grant the
minimal refill in place (no tow animation) and the rescue is still consumed — no
undefined path. Subsequent dry-outs end the run normally.

#### Scenario: Lurleen saves the first dry-out

- **WHEN** the sputter grace expires while Lurleen is following and the rescue is unused
- **THEN** the run continues from a juice source with the rescue flag consumed

### Requirement: Run end always produces a summary

Every run end (any cause) SHALL show a score screen: final high-water score, days
survived, cause, best combo, and the leaderboard views. The summary SHALL also fire
the final leaderboard submit and the `run_end` analytics event.

#### Scenario: Death is legible

- **WHEN** a run ends for any cause
- **THEN** the score screen names the cause and shows score, days, and leaderboards

### Requirement: External smile/juice awards use the standard interfaces

Future systems (passenger quests) SHALL award scoring bursts via the scoring module's
award API and juice tips via `bubbles.addJuice`, both of which SHALL behave correctly
for burst-sized values (combo credit for awarded smiles, sputter exit on tipped juice).

#### Scenario: A quest-style award behaves like organic play

- **WHEN** an external system awards a smile burst and a juice tip mid-run
- **THEN** the burst feeds combo/high-water normally and the juice exits sputter if active
