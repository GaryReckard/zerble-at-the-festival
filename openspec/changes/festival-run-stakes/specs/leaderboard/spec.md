# leaderboard — delta

## ADDED Requirements

### Requirement: Local top-10 board with zero network dependency

The game SHALL keep a local top-10 of Festival Run results (`zerble-leaderboard-local`:
name, high-water score, days, date) in `localStorage`, updated at run end, rendered on
the score screen and reachable from the title card. The local board SHALL work fully
offline and is the fallback whenever the global board is unavailable.

#### Scenario: A finished run lands on the local board

- **WHEN** a run ends with a score that beats the 10th local entry
- **THEN** the run is inserted in rank order and the board persists across reloads

### Requirement: Global board client protocol — token, heartbeats, final submit

For Festival Run with the global board enabled, the client SHALL: request a signed run
token from `POST /run/start` at run start; send heartbeats (~60s cadence plus
milestone triggers: new high-water, new day) carrying token, high-water score, day,
and elapsed time; send a final submit at run end; and register a `pagehide`
`sendBeacon` so an abandoned tab's last state still stands as its entry. The client
SHALL treat every network failure as non-fatal: gameplay never blocks, stalls, or
errors on leaderboard traffic, degrading silently to the local board.

#### Scenario: A closed tab still records

- **WHEN** a player closes the tab mid-run without dying
- **THEN** the beacon (or last heartbeat) stands as that run's global entry

#### Scenario: The Worker being down is invisible

- **WHEN** `/run/start` fails or times out
- **THEN** the run proceeds normally with local-only recording and no player-facing error

### Requirement: Worker-side guardrails

The Worker (in-repo at `workers/leaderboard/`, deployed separately by Gary) SHALL
enforce: token-bound submissions only; monotonic, rate-plausible score growth
(max smiles/min ceiling, day-vs-elapsed consistency); per-IP and per-token rate
limits; name sanitation (length cap, profanity filter, fallback display name for
blanks) before any name is stored or served; quarantine above an outlier threshold
pending admin review; an admin-authenticated delete; and daily + all-time board reads.
The signing secret and admin key live only in Worker env — never in client code.
The plausibility ceiling SHALL be derived from the multiplied theoretical max rate
(combo ×4 × Lurleen ×2, plus a Star Power allowance), never from un-multiplied
historical smile rates. Board arrays in KV use read-modify-write and are accepted as
eventually consistent under concurrent run-ends (authoritative per-run entries are
unaffected) — a deliberate simplicity trade-off at this scale.

#### Scenario: An implausible submission is rejected

- **WHEN** a submission's score exceeds the plausible ceiling for its token's elapsed time
- **THEN** the Worker rejects or quarantines it and the public board is unaffected

#### Scenario: A hostile name never renders

- **WHEN** a run is submitted with a profane or oversized name
- **THEN** the stored/served entry uses the sanitized or fallback name

### Requirement: Leaderboard privacy boundary

The player's name SHALL be sent only to the project's own Worker endpoints, only in
Festival Run, and the title card SHALL disclose near the name field that Festival Run
scores + name appear on a public leaderboard. GA4 SHALL receive run metrics only
(never the name), per the player-identity capability.

#### Scenario: Cruisin' generates zero leaderboard traffic

- **WHEN** a Just Cruisin' session is played end to end
- **THEN** no request is made to any leaderboard endpoint
