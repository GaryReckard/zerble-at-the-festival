# scoring — delta

## ADDED Requirements

### Requirement: All score mutations route through one scoring module

Every smile gain (pickup collect, future awards, `__dbg.addSmiles`) and loss (frown
deduction, vendor spend) SHALL flow through a single scoring module that owns current
score, high-water mark, and combo state. Direct `score +=` writes outside the module
MUST NOT exist after this change.

#### Scenario: Debug smiles still respect the pipeline

- **WHEN** `__dbg.addSmiles(50)` runs mid-run
- **THEN** current score, high-water mark, and combo credit all update consistently

### Requirement: Chain combo multiplies rapid smile collection

Collecting smiles in quick succession SHALL build a multiplier (x1 → x2 → x3 → x4
cap) driven by a decaying chain window (each collect refreshes it). The multiplier
SHALL apply to each collected smile's score value. Any frown or damaging NPC hit
SHALL break the combo to x1. Star power SHALL pin the combo at cap for its duration.
Combo credit counts smiles however earned — no action-variety weighting (explicitly
tabled by Gary 2026-08-28).

#### Scenario: A chain builds and pays

- **WHEN** the player collects smiles fast enough to hold the chain window open
- **THEN** the multiplier climbs and each smile scores at the current multiplier

#### Scenario: A hit resets the chain

- **WHEN** the player damages an NPC mid-chain
- **THEN** the multiplier drops to x1 immediately

### Requirement: Lurleen following doubles scoring

While Lurleen is in her `following` state during a Festival Run, all smile score
SHALL be doubled on top of the chain multiplier (stacking multiplicatively, e.g.
combo x3 with Lurleen = x6), surfaced as ♥×2. Damaging an NPC SHALL scare Lurleen
off (she exits `following`), removing the doubler until she is won back.

#### Scenario: The doubler stacks and is lost on a hit

- **WHEN** the player collects at combo x3 with Lurleen following, then hits an NPC
- **THEN** the pre-hit smile scored x6, Lurleen leaves, and the doubler is gone

### Requirement: High-water mark is the recorded score

The leaderboard-recorded score SHALL be the run's high-water mark (peak current
score). Spending smiles (vendor refills) and frown deductions lower current score but
never the recorded mark. Current score SHALL floor at zero.

#### Scenario: Spending never erases a peak

- **WHEN** a player peaks at 300, then spends and frowns down to 180
- **THEN** the recorded score remains 300 while current score reads 180

### Requirement: Combo state is legible at a glance

The combo SHALL be surfaced by exactly two always-consistent signals: the HUD badge
(multiplier + draining chain ring, ♥×2 alongside) and the audio pitch ladder (each
chained collect steps up; reset is audible). No hidden scoring rules may exist that
these two surfaces cannot express.

#### Scenario: Eyes-free combo tracking

- **WHEN** a player chains smiles without looking at the HUD
- **THEN** the rising pitch ladder alone communicates the chain building and breaking
