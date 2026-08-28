# player-identity — delta

## ADDED Requirements

### Requirement: Name capture on the title card

The title card SHALL offer an optional "What's your name?" text input (max 20
characters, trimmed) above the start button. A non-blank value SHALL persist to
`localStorage` (`zerble-player-name`) and prefill on future visits. A blank value
SHALL reproduce today's behavior exactly: no greeting, no name in copy, no prompt
nagging. The start-button tap handler MUST read the field synchronously and MUST NOT
introduce any async hop before `Sound.init()` (iOS audio tripwire).

#### Scenario: Returning player keeps their name

- **WHEN** a player who previously entered "Gary" reopens the game
- **THEN** the field is prefilled with "Gary" without re-typing

#### Scenario: Blank name changes nothing

- **WHEN** the player starts without entering a name
- **THEN** all copy, toasts, and screens render exactly as they do today

#### Scenario: Name entry never breaks iOS audio

- **WHEN** the player types a name and taps the start button on iOS Safari
- **THEN** `Sound.init()` still runs synchronously inside the tap gesture and audio unlocks

### Requirement: Name usage in toasts is sprinkled, not saturated

Toast banks MAY interpolate the player's name via a single shared formatting helper.
Name-bearing variants SHALL appear occasionally (roughly 1-in-4 of eligible toasts at
most) and every name-bearing line SHALL have a nameless fallback used when no name is
set.

#### Scenario: Nameless players get the fallback line

- **WHEN** a toast fires from a bank containing name variants and no name is set
- **THEN** the nameless fallback renders with no empty placeholder artifacts

### Requirement: The name never reaches GA4

The raw name string MUST NOT be sent to GA4 in any event, parameter, or user
property. Only `name_entered` (boolean) and `name_length` (number) MAY be tracked.

#### Scenario: Analytics stays name-free

- **WHEN** any analytics event fires during a named player's session
- **THEN** no event payload contains the name string
