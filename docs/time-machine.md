# Time Machine operations

The current game is [game.zerble.net](https://game.zerble.net/). The playable history and every snapshot are at [game-archive.zerble.net](https://game-archive.zerble.net/), served by one separate [archive repository](https://github.com/GaryReckard/zerble-game-archive). No repository or DNS record is needed per snapshot.

## What a snapshot preserves

The builder extracts the original public game files from an exact commit. It does not execute historical npm scripts, Vite configuration or GitHub workflows. It uses the trusted, locked current toolchain, validates historical Three.js/Rapier versions, preserves the historical Three.js shim, and bundles the game with relative asset URLs.

The prepared game includes an archive-only compatibility layer. It supplies page-local localStorage, sessionStorage, cookies and IndexedDB, blocks persistent caches/service workers/filesystem access, and prevents production leaderboard requests. Reloading, leaving and revisiting starts fresh, including the map and Passport. Restart-dependent graphics settings are disabled because they cannot carry changes across a reload. Other live settings work for the current visit.

Each URL contains both the full source SHA and an adapter/toolchain content hash. `snapshot.json` records the source, adapter, runtime dependencies and exact SHA-256 of each output file. Existing packages are validated rather than overwritten. An adapter correction gets a new URL while existing bookmarks keep their package.

Only the snapshot's `index.html` is published; developer/sandbox HTML, source documents, Git metadata, credentials and private configuration are excluded. Playable snapshots refuse to boot on the shared github.io hostname. The dedicated archive hostname is the browser-enforced boundary protecting live saves.

## Publish a milestone

In the game repository, add a reviewed entry to `tooling/time-machine/milestones.json` when a player-facing description is available. Resolve the end of an integrated development burst, include its follow-up fixes, and check the changelog at that commit. Date labels describe the integrated snapshot rather than promising a formal stable release.

Create and push a `time-machine/YYYY-MM-DD` tag pointing to that source commit. The archive repository's **Publish Time Machine** workflow polls milestone tags twice an hour. Run it manually with `source_ref=milestones` to publish immediately. A tagged commit without reviewed copy gets a neutral dated chapter rather than exposing an unfiltered commit message or hidden mechanics.

The first collection contains twelve selected chapters from May 23 through November 16, 2026. Their evidence is recorded in the milestone catalog.

## Publish any old commit

Open the archive repository's [Publish Time Machine workflow](https://github.com/GaryReckard/zerble-game-archive/actions/workflows/publish.yml), select **Run workflow**, enter a commit hash, branch or tag as `source_ref`, and run it. A successful run records its permanent URL under `Ready:` in the build log and in the archive's `snapshots.json`. Untagged, uncurated commits get a direct link without being added to the main timeline. The June 2 commit `4cabb2a` was published this way during production acceptance, alongside the twelve curated chapters.

The workflow serializes all archive writers, preserves the existing site branch, commits complete packages, and deploys only after a successful build. It runs independently of the live game and needs no personal access token. Its normal archive-repository token is supplied only to the final publishing step; historical scripts/configuration are never run.

Manual local preparation and isolation checks:

```sh
node bin/test-time-machine.mjs
node bin/time-machine.mjs --output /private/tmp/zerble-archive-preview --ref 5a73bb3
node bin/time-machine.mjs --output /private/tmp/zerble-archive-preview --milestones
python3 -m http.server 8877 --bind 127.0.0.1 --directory /private/tmp/zerble-archive-preview
```

Use `?mute=1&analytics=0` on verification URLs. Stop the server and close game tabs afterward. The earliest games predate the mute URL option, so the archive adapter supplies a silent audio destination for that option without changing ordinary playback.

## Analytics

The existing GA4 property **Zerble at the Festival**, web stream `14943908727`, and measurement ID `G-CY1FNMY8H8` serve the live game, archive and timeline. Its primary URL was updated to `https://game.zerble.net`; no second property or stream is needed.

Event-scoped custom dimensions were registered in GA4 on November 16, 2026:

| Dimension | Parameter | Values |
| --- | --- | --- |
| Game version | `game_version` | First twelve characters of the exact source commit; `timeline` for the archive homepage |
| Game channel | `game_channel` | `live`, `archive`, `timeline` |

The live build replaces its version token with the source CI commit, and sets both fields before GA configuration. Archived games replace the historical tag injector with a trusted initializer that attaches the snapshot version to all existing events. `archive_play` also records a real historical title-button click, including versions that predate gameplay instrumentation. Original event coverage still differs by era; new fields do not backfill old data or invent missing gameplay events.

Archive analytics cookies are memory-only too, so each visit begins a new analytics identity. Live saves and live cookies are not read or copied. The archive respects Do Not Track and Global Privacy Control, and `analytics=0` disables its tag for verification. The network policy permits only read-only game/music assets and the Google Analytics collection endpoint, never leaderboard submissions.

In GA4 Explorations, import **Game version** and **Game channel**, then filter `Game channel = live` for current-game reporting or `archive` for historical comparisons. Custom dimensions apply to new collection, not old unlabelled events; normal reporting may take time to process. See [Google's event parameter guide](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters).

## DNS and HTTPS

Both DNS-only CNAME records point to `garyreckard.github.io`:

| Name | Pages custom hostname |
| --- | --- |
| `game` | `game.zerble.net` on the game repository |
| `game-archive` | `game-archive.zerble.net` on the archive repository |

Gary added both DNS records and the live Pages hostname during implementation. The archive Pages source must be GitHub Actions. Enable HTTPS after certificate issuance; do not bypass browser certificate warnings. Moving live play to the new origin starts new saves, which Gary explicitly accepted.

## Acceptance

Run `npm run check`, `npm run build`, archive isolation tests and the real title-button/gameplay path. The real map tests cover concurrent unions, reset epochs and stale-write fencing against independent memory factories while native sentinels remain untouched. A build pass alone is not a browser pass. Physical iOS audio and long play sessions require device acceptance and must not be inferred from muted desktop starts.

See [the Time Machine verification record](../verification/time-machine/README.md) for observed results and remaining limits.
