# Road snapshot CI portability, October 29, 2026

[Original road verification](../2026-10-28/README.md) · [Toolchain](../../../docs/toolchain.md)

## Failure and diagnosis

[GitHub Actions run 40873335951](https://github.com/GaryReckard/zerble-at-the-festival/actions/runs/40873335951/job/123445738900)
failed at `bin/test-road-surfaces` on migration commit
`5211a1b09b9ac8786a6f2b7462e1d35cb393b8bd`. The seed-zero layout hash was
`53f2ee320cafa8b85eae1a086ad64ebb5c38c160ce9de8818be5d5e2a8195ea0`
instead of the recorded
`3a0d640c85da330f5da83b46a9a7fc00cd28222dbc1e0a8a507918d7097ee415`.

The unchanged test passed on macOS arm64 with both Node 24.10.0 and 24.22.1.
An isolated Linux x64 `node:24.22.1-bookworm-slim` container reproduced the
exact CI hash and failure. This ruled out Node's version alone as the cause.

Dumping and recursively comparing all point/nearest records and festival plans
for seeds 0, 42, 1234 and 3248888364 found **11 differing values**, consisting
of four `facing`, four `dirAngle` and three `yaw` values. The largest absolute
difference was `8.881784197001252e-16` radians. No other values differed.
[Complete differing fields](differences.json).

For example, one facing angle was `-0.31249155973451975` on macOS and
`-0.3124915597345198` on Linux. `nearestRoad` obtains these cosmetic facing
angles through `Math.atan2`; its production comment explicitly excludes them
from downstream deterministic hashing, but this newer regression snapshot had
hashed them without normalization. Some planner yaw values carried the same
last-bit difference into the second hash, which CI had not yet reached.

The module-type warnings preceding the assertion were unrelated to this
failure; both reproductions also emitted them.

## Fix and regression coverage

Only the **test serialization** of keys `facing`, `dirAngle` and `yaw` uses
12 decimal places. Positions, distances, densities, flags, object structure,
route hashes and other snapshot values remain exact. No production source or
RNG stream changed. Angle mutations of `1e-10` radians still fail the new test
controls, while the observed last-bit differences serialize identically.
Controls also establish that last-bit changes in non-angle fields still fail,
as do changes in buildability or null-versus-zero facing.

The original raw hashes in `layout-baseline.json` are preserved. Before adding
the portable hashes, all eight original point/plan hashes were rechecked against
the macOS dump; normalization then produced identical hashes for all eight
macOS/Linux record sets. This preserves the historical baseline instead of
accepting the failed CI hash as a replacement.

## Reproduction

From the repository root, dump the exact unnormalized records with:

```sh
node verification/roads/2026-10-29-ci-layout/dump-layout.mjs > /tmp/road-layout-mac.json
```

To dump Linux x64 values using an existing Docker engine:

```sh
docker run --rm --platform linux/amd64 --network none \
  -v "$PWD:/game:ro" -w /game node:24.22.1-bookworm-slim \
  node verification/roads/2026-10-29-ci-layout/dump-layout.mjs > /tmp/road-layout-linux.json
```

These diagnostic dumps contain the full four-seed record sets; stderr reports
the raw hashes. Compare parsed values recursively rather than relying on the
hash alone. The Docker command may need to download the official image first.

## Validation and limits

- The fixed `node bin/test-road-surfaces` passed on macOS arm64, Node 24.10.0.
- The fixed test also passed on Linux x64, Node 24.22.1, including the existing
  42 paved/585 dirt approach visits and 24,639 dry-ribbon probes.
- A fresh Linux x64 container passed the complete sequence: `npm ci`,
  `npm run check`, `npm run build` and `npm run test:toolchain:http`.
  The latter checks development and production resources under the Pages
  project subpath, plus captures and access boundaries. [Full log](linux-ci.log).
- All eight original raw hashes were checked for preservation, and `git diff
  -- src` confirmed that no production source was edited.
- The diagnostic dump script was also executed from its saved report location;
  it reproduced all original macOS raw hashes.

The container runs Debian Bookworm with Python 3.11 rather than the hosted
Ubuntu runner with Python 3.12, but
it reproduced the original hosted failure byte-for-byte. Host filesystem mounts
are read-only, full-suite dependencies are installed inside the disposable
container, and no browser or game-runtime change was needed for this test-only
fix. A new hosted Actions result remains pending the follow-up commit's push.
