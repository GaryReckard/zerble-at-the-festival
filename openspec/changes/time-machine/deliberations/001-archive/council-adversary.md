## Adversary's Position

### Priority Sequence

1. Emit a synchronous classic/IIFE policy before every executable historical script and fail closed if installing it fails. A first-position module script is still deferred, so it cannot protect later parser-executed classic scripts.
2. Audit the complete reachable graph, including worker/worklet realms, then qualify one pre-Vite and one current snapshot through the real title click on Low and Mid.
3. Exercise page reload, duplicate tabs, bfcache restoration, map reset and blocked network writes before bulk publication.
4. Publish packages independently of the live game, pinning source SHA, adapter revision and package checksum; then add the full milestone set.

### Vulnerabilities Found

- **A deferred bootstrap leaves a policy gap:** The design proposes an awaited archive entry before game imports, but that does not establish ordering ahead of retained classic inline HTML scripts. Require a synchronous bootstrap ahead of all executable scripts, and guard every subsequent boot path on successful policy installation. Current boot already dynamically imports main (`src/boot.js:10-15`), so putting policy in an unrelated module is insufficient. Severity: **High**.
- **Workers have separate globals:** Window replacements do not alter IndexedDB, fetch or CacheStorage inside workers. Current map and landscape code launch module workers (`src/festivalMap/geography.js:13`, `src/landscape/planner.js:13`). Those currently need geography computation rather than storage, but arbitrary historical commits need a graph audit or worker policy injection, with unsupported APIs rejected before publication. Test the real map worker, not just an isolated fake-IDB factory. Severity: **High**.
- **Blocked POST alone does not mean no production traffic:** The leaderboard has an enabled production endpoint (`src/leaderboard.js:57-76`) and issues POST requests (`src/leaderboard.js:121-125`), while MIDI imports require esm.sh (`src/midiPlayer.js:23-24`). Disable the historical leaderboard at build time and combine an explicit read-only asset allowlist with CSP, fetch/Request, XHR and beacon handling. Reject unknown analytics/production endpoints; do not allow arbitrary HTTPS merely to preserve MIDI. Severity: **High**.
- **Fresh sessions change Settings restart behavior:** Applying settings writes a resume snapshot and reloads (`src/settings.js:291-296`); the live game consumes that sessionStorage record on boot (`src/main.js:225-235`). A fully ephemeral archive will intentionally forget both the setting and resume record. Tell players that reload starts fresh and either adapt archive settings to apply startup choices in the current session or clearly disable reload-dependent settings; otherwise their Apply action appears broken. No persistence bridge is required for scores/progress. Severity: **Medium**.
- **Map compatibility requires transactional tests:** Native map reset uses epochs, atomic read/union/write and completion/abort handling (`src/festivalMap/storage.js:20-35`). Test the real storage module against the archive factory, including reset and stale writes, and prove the native IndexedDB sentinel remains untouched. Replacing Web Storage alone cannot satisfy the no-saves contract. Severity: **High**.
- **SHA-only URLs collide with adapter fixes:** Source SHA identifies gameplay, but not the storage/network shim or trusted toolchain described in design.md. Bind adapter revision and package checksum in the manifest, and choose an explicit policy for publishing an improved adapter for the same source without silently overwriting an immutable URL. A content/build suffix is the simplest immutable identity. Severity: **Medium**.
- **Audio proof must use the actual gesture:** Do not turn the archive's Play link into an async game-start bridge. Navigate to the historical title, finish all preparation before enabling its existing start button, and retain the synchronous Sound.init gesture contract (`AGENTS.md:97-99`, `src/sound.js:273-319`, `ARCHITECTURE.md:785`). Desktop muted boot cannot establish physical-iOS audio acceptance. Severity: **High**.

The archived HTML should strip its install manifest and publish no alternative executable HTML entry. The normal GitHub project-path fallback shares the original live github.io origin, so archive boot there must remain disabled until the dedicated archive hostname is active, or the policy guarantee must be independently established for that shared-origin path. Separate-domain storage isolation is the permanent safety boundary in design.md.

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: Archive policy must apply before every historical executable script, including workers and reload paths.
- **Recommendation**: Proceed after the synchronous bootstrap, worker graph audit, real map storage tests and early/recent title-click proofs pass. Document the intentional settings/reload behavior and adapter identity before bulk publishing; physical-iOS acceptance can remain explicitly unclaimed until measured.
