## Why

Players should be able to revisit meaningful stages of Zerble's development without checking out Git commits or risking their current progress.

## What Changes

- Add a curated, dated Time Machine using the road timeline and animated cart from zerble.net.
- Publish live play at game.zerble.net and the timeline plus all snapshots at game-archive.zerble.net.
- Prepare historical commits through a trusted archive builder, with memory-only browser storage, no score submissions and version-labeled gameplay analytics.
- Support milestone tags and manually selected commits; retain all snapshots in one archive repository.

## Capabilities

### New Capabilities

- `time-machine`: dated playable milestones, isolated ephemeral sessions and repeatable archive publishing.

### Modified Capabilities

None. Historical gameplay remains as recorded; archive compatibility is applied only to prepared output.

## Impact

Touches deployment, historical HTML preparation, a new archive-only storage bootstrap and a live title link. Adds fake-indexeddb for in-memory archive databases. No world, RNG, renderer, physics or audio-gesture changes. Historical boot ordering must run the storage bootstrap before any game code.

## Scope Check

Reviewed live Pages workflow, pre-Vite importmap bootstraps, current Vite entry, local/session storage callers, IndexedDB map storage, analytics and leaderboard client. Only index.html and its reachable game assets are published for each snapshot; sandbox/preview HTML and private files are excluded. The separate zerble.net repository is a read-only UI reference, not an edit target.
