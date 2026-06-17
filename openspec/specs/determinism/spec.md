# Capability: determinism

> **Source:** `src/rng.js` (whole file). Cross-cutting consumers: `chunks.js`,
> `lakes.js`, `forests.js`, `worldgen/*`, `sound.js` (music/drum seeds), `main.js`
> (`?seed=` wiring). This spec defines the seeding *contract*; consumers are
> specified in their own capabilities.

Determinism is load-bearing. Every procedural decision in the game — chunk theme,
prop placement, lake position, forest contents, the entire worldgen v2 layout,
music/drum seeds — derives from one seeding regime in `rng.js`. The world is
identical across reloads at the same coordinates, and identical across rendering
engines (V8 / JavaScriptCore / SpiderMonkey) for the worldgen layer.

## ADDED Requirements

### Requirement: Single shared seeding regime

The game SHALL derive all procedural randomness from the primitives in `rng.js`
(`hash2`, `worldHash`, `mulberry32`, and their cell/edge/pair wrappers). New
procedural systems SHALL NOT fork a separate hash module with its own mixing
constants; they SHALL build on these primitives so every system shares one regime
(`rng.js:86-102`).

#### Scenario: A new procedural system seeds from rng.js

- **WHEN** a new system needs per-location randomness
- **THEN** it obtains it through `worldHash` / `chunkRng` / `cellRng` / `pairRng`
  with a fresh salt, not a newly-invented hash function

### Requirement: Session-stable vs session-varying hashes

`rng.js` SHALL expose two hash flavors with distinct stability guarantees:
`hash2(x, y)` SHALL be a pure 32-bit hash unaffected by the session seed (for
content that MUST stay identical across all sessions, e.g. the `(0,0)` main-stage
layout), and `worldHash(x, y, salt)` SHALL mix in the session seed (for content
that varies per session). When the session seed is 0, `worldHash(x, y, 0)` SHALL
collapse to `hash2(x, y)` (`rng.js:40-60`).

#### Scenario: Origin content is session-invariant

- **WHEN** the same fixed coordinate is hashed via `hash2` under two different
  session seeds
- **THEN** the result is identical

#### Scenario: World content varies by session seed

- **WHEN** a coordinate is hashed via `worldHash(x, y, salt)` under two different
  non-zero session seeds
- **THEN** the results differ

#### Scenario: Default seed preserves legacy behavior

- **WHEN** the session seed is 0 and `worldHash(x, y, 0)` is called
- **THEN** it returns exactly `hash2(x, y)`

### Requirement: Session seed set once at boot

The session seed SHALL be resolved once at boot from `?seed=` and stored in module
state (`SESSION_SEED`). `setSessionSeed` SHALL accept either a string (hashed
FNV-1a-style to 32-bit) or a finite number (coerced to 32-bit), default to 0
otherwise, and return the resolved 32-bit integer so callers can echo it back to
the player (`rng.js:17-38`).

#### Scenario: String seed is hashed to 32-bit

- **WHEN** `setSessionSeed("festival")` is called
- **THEN** it stores and returns a deterministic 32-bit integer derived from the
  string

#### Scenario: Numeric seed is coerced

- **WHEN** `setSessionSeed(12345)` is called
- **THEN** it stores and returns `(12345 | 0) >>> 0`

#### Scenario: Invalid seed falls back to zero

- **WHEN** `setSessionSeed` receives `undefined`, an empty string, or a non-finite
  number
- **THEN** the session seed resolves to 0

### Requirement: Salt-stacked independent streams

A caller SHALL be able to derive multiple independent random streams from the same
coordinate by passing a distinct `salt`. The session seed SHALL be split across
both hash inputs (not merely XORed into the final result) so the salt interacts
with the avalanche rather than nudging the output (`rng.js:49-60`). Worldgen salts
SHALL come from `worldgen/constants.js` and SHALL be chosen to not collide with the
`lakes.js` / `forests.js` salt literals, so worldgen features do not spatially
correlate with legacy lake/forest placement (`rng.js:98-102`).

#### Scenario: Same coordinate, different salts, independent results

- **WHEN** `worldHash(cx, cz, A)` and `worldHash(cx, cz, B)` are called for `A != B`
- **THEN** the two streams are uncorrelated, letting "what theme" stay decoupled
  from "what props"

### Requirement: Salt discipline preserves existing worlds

Changing a salt value, a hash input, or the ordering of `rng()` draws within an
existing system SHALL be understood to regenerate already-seeded chunks / forests /
lakes differently for anyone mid-session. New randomness inside an existing system
SHALL be added by salting with a fresh constant, never by reordering or adjusting an
existing draw.

#### Scenario: Adding randomness without disturbing neighbors

- **WHEN** a new random decision is added to an already-shipped system
- **THEN** it is seeded with a new salt constant, leaving every prior draw's seed
  and order unchanged

### Requirement: Engine-stable worldgen via integer quantization

Because `Math.sin/cos/atan2/hypot/pow` are not bit-identical across JS engines, any
float that reaches a hash input or a comparison threshold in the worldgen layer
SHALL first be snapped to an integer bucket via `quantize(v, step)`. All worldgen
seeding wrappers (`cellHash`, `cellRng`, `edgeHash`, `pairHash`, `pairRng`) SHALL
take integer cell coordinates (`rng.js:90-119`).

#### Scenario: Floats are quantized before hashing

- **WHEN** a worldgen layer derives a seed from a world-space position
- **THEN** the position is passed through `quantize` first, so the same location
  yields the same bucket on every engine

### Requirement: Order-independent shared-feature seeding

Features that span a region boundary (a road/river between two anchors, a crossing
point on a shared chunk edge) SHALL be seeded from the shared feature's own identity
via `edgeHash` / `pairHash`, which canonicalize their two endpoints to `(min, max)`
order before hashing. The result SHALL NOT depend on argument order or generation
order, so both sides of a seam compute the identical value with no communication
(`rng.js:121-149`).

#### Scenario: Both endpoints agree regardless of order

- **WHEN** `edgeHash(ax, az, bx, bz, salt)` and `edgeHash(bx, bz, ax, az, salt)`
  are called
- **THEN** they return the identical value

#### Scenario: A seam feature seeds from its own identity

- **WHEN** an arterial between two hearts is seeded
- **THEN** its meander is seeded by `pairHash` of the unordered heart pair, never
  by forwarding one region's output into the other's input
