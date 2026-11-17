# Time Machine verification

Date: November 16, 2026. Source milestones end at `380cf22`. Browser-qualified archive adapter: `7781f9486b16`. Final publication adapter: `11d1fbcbd442`, with identical runtime assets and an earlier UTF-8 declaration in HTML; [package identity evidence](package-identity.json) binds each published package to its qualified runtime.

## Observed locally

- `npm run check` passed the complete repository suite, including the new archive isolation checks.
- `npm run build` and `npm run test:toolchain:http` passed. Title/menu checks were repeated after the compact-navigation adjustment.
- All twelve selected historical commits built with the same trusted builder. Each final package reached its real title button and running game in the in-app browser with `mute=1&analytics=0`, with no console errors. [Per-snapshot results](desktop-smoke.json), [early gameplay](early-game.jpg), [recent gameplay](recent-game.jpg).
- The latest snapshot returned to `0 smiles, personal best 0` after reload. Unit checks exercise independent local/session memory stores, protected native sentinels and independent IndexedDB factories.
- The actual map storage implementation passed concurrent bit-union writes, fresh-factory isolation, reset epoch advancement and stale-write rejection against the memory adapter. The native IndexedDB sentinel factory remained empty.
- All package file checksums matched their manifests. Rebuilding an existing package left the entire archive tree unchanged. A deliberately corrupted copy of a package was rejected rather than overwritten.
- Both timeline orders worked. Desktop and 390×844 requested mobile viewport checks showed twelve chapters and no horizontal overflow (375 CSS pixels of usable width in the mobile browser). [Desktop](timeline-desktop.jpg), [mobile](timeline-mobile.jpg).
- Live title navigation stayed within a 568×320 requested viewport, with 44px-high controls. The updated live game started through its real mode button on Low and Mid, without console errors.
- Both CNAME records resolved to `garyreckard.github.io`. The live Pages API confirmed `game.zerble.net` with HTTPS enforced. The separate archive repository and its custom hostname were created.
- GA4 event-scoped Game version (`game_version`) and Game channel (`game_channel`) were created and verified in the existing property; its web stream URL was changed to `https://game.zerble.net`. The source tests verify metadata decoration and the restricted Analytics endpoint allowlist.

## Public release acceptance

Verified on November 17, 2026:

- [Live CI and deployment](https://github.com/GaryReckard/zerble-at-the-festival/actions/runs/44020935381) passed for `c68f7ef`. The public title's Time Machine link points to the archive, its GA version is `c68f7ef42e13`, and a real Just Cruisin' start completed without console errors.
- [Initial archive deployment](https://github.com/GaryReckard/zerble-game-archive/actions/runs/44021153915) passed. Both custom domains resolve and enforce HTTPS; the public timeline has twelve chapters and both date orders work. [Published road view](timeline-road.jpg).
- [On-demand publication](https://github.com/GaryReckard/zerble-game-archive/actions/runs/44021715783) successfully prepared `4cabb2a` from June 2 as a thirteenth, unlisted snapshot, preserving the twelve curated chapters and existing packages. Its real public title-button start completed without console errors.
- GA4 Realtime received `archive_play` with `game_channel=archive` and `game_version=380cf22f7654`, verified by drilling into both event parameter values. This confirms actual collection in addition to local metadata tests.
- The final publication packages retain byte-identical runtime scripts, styles and assets to the twelve locally booted packages; only UTF-8 declaration placement and integrity metadata changed. The newest final package also passed a public start.

Local previews intentionally send no Analytics events. The desktop starts are smoke tests, not complete gameplay regressions or device performance measurements. Physical iOS audio and long play sessions remain untested; no device acceptance is claimed from muted desktop verification.

## Browser/process ownership

Verification used one temporary in-app game tab sequentially, never standalone headless WebGL. Each game was replaced by navigation before starting the next. Owned loopback servers were stopped at task completion; Gary's existing server was not stopped or reused for mutation. The public timeline and GA verification remain open as deliverables.
