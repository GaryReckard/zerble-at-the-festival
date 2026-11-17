# Deliberation Summary

## Context

- **Task:** Publish a curated playable history with fresh archive sessions, a separate archive origin, trusted historical builds and the zerble.net road timeline.
- **Personas Consulted:** Architect, Adversary, Pragmatist + Mediator.
- **Mode:** Tier 3 synthesis; no Round 2.
- **Date:** 2026-11-16.

## Synthesized Plan

### Change Group 1: Prove the archive boundary

**Scope:** The verification surface and archive-only compatibility contract.
**Estimated Effort:** First implementation slice, before bulk history preparation.
**Tasks:**
1. Build a synchronous classic/IIFE policy that installs page-local Web Storage and a fresh IndexedDB factory before every historical executable script. Guard all boot paths on successful installation and fail closed if installation fails. Assert ordering in final generated HTML, not only intermediate source.
2. Exercise the existing map store against independent factories, including union writes, transaction completion/abort/error, reset epochs and rejection of stale writes. Prove native Web Storage and IndexedDB sentinels remain unchanged.
3. Audit the complete reachable worker/worklet graph. Inject the same policy in executable realms where needed, or reject unsupported paths before publication. Combine CSP, read-only asset-host allowlists and fetch/Request/XHR/beacon controls; disable historical leaderboard and analytics integration rather than merely blocking POST.
4. Qualify one early pre-Vite and one recent snapshot through their real title controls on Low and Mid. Check reload, duplicate tabs, bfcache restoration, the real map worker and absence of production traffic. Clearly disable or adapt restart-dependent settings because an intentional reload also discards their pending state.

### Change Group 2: Prepare and publish immutable snapshots

**Scope:** One trusted builder and one independently serialized archive publisher.
**Estimated Effort:** Second slice, after the two-version proof passes.
**Tasks:**
1. Extract only public game files, preserve historical shim selection and validate historical runtime dependency declarations against supported pinned packages. Never execute historical package scripts, Vite configuration or workflows; reject unsupported versions with useful diagnostics.
2. Define package identity as source SHA plus adapter/toolchain fingerprint, with a package checksum and explicit qualification metadata. Use a subordinate revision path or build suffix so adapter fixes can publish without overwriting an existing URL. A source SHA by itself is not sufficient identity.
3. Publish the two qualified snapshots atomically in the single archive repository, using one concurrency group across every publishing trigger. Verify a second publication retains every existing URL and byte checksum. Keep archive credentials, checkout and output separate from live deployment.
4. Expand through the same pipeline to all curated milestones, milestone-tag discovery and manually selected commits. Add timeline links only for successfully published packages; preserve the previous site on any failed preparation or publication.

### Change Group 3: Deliver the road timeline and player flow

**Scope:** The archive front door and current-game navigation.
**Estimated Effort:** UI slice after the foundation; static layout work can proceed independently of snapshot qualification.
**Tasks:**
1. Adapt only the road timeline CSS and cart from the read-only zerble.net reference, with dated gameplay summaries and source provenance. Do not port unrelated site scripts or advertise hidden discoveries.
2. Support date ordering by reloading the page or explicitly disposing/reinitializing the cart, since its initializer retains the final timeline card. Pause animation when hidden, removed or reduced motion requires it.
3. Navigate directly to each historical title screen, with an archive notice, return link and fresh-session explanation. Do not retain hidden running games or insert an asynchronous hop between the historical start gesture and audio initialization.
4. Link the live game to the archive root and the archive back to current play. Verify keyboard navigation, narrow layouts, direct/deep links and no alternative unprotected executable HTML or install manifest in prepared packages.

### Change Group 4: Verify release and complete operations

**Scope:** End-to-end evidence, documentation and hostname installation.
**Estimated Effort:** Release slice, with external DNS and physical-device acceptance tracked separately.
**Tasks:**
1. Run current repository checks/build, generated-tree policy checks and sequential bounded browser smoke tests for published snapshots. Record build, desktop boot and physical-iOS audio status separately; muted desktop play is not iOS audio proof.
2. Prepare the two Pages sites and exact DNS CNAME instructions. Serve playable archives only on the dedicated archive origin or approved local verification hosts; disable their shared-origin github.io fallback while it could share storage with the original live game.
3. Verify public DNS, HTTPS, direct snapshot URLs, current-game links and unchanged archive URLs after a subsequent publication once Gary installs the records. Stop owned test tabs/servers and verify teardown.
4. Update CHANGELOG, documentation, tasks and session log with source/adapter/dependency identities, fresh-session limits, publishing procedures and remaining physical-device acceptance. Apply current AGENTS.md/Vite policy instead of obsolete no-build context.

## Final Recommendation

**Proceed with mitigations.** The design is sound with a dedicated archive hostname and memory-only sessions, provided the synchronous first-script policy, complete executable-realm coverage, real map-store contract tests and two representative game starts pass before bulk publication. The approved scope remains intact; DNS/HTTPS and physical-iOS audio must remain explicitly pending until externally verified.

## Convergence Points

- Prove early/recent real-game starts and map-storage compatibility before bulk publication.
- Keep archive publication independent of the current game.
- Preserve historical engine and trusted start-gesture behavior.
- Use the same qualified builder for initial snapshots, later milestones and manual publication.
- Record exact gameplay source, adapter/toolchain identity and measured qualification separately.

## Conflicts Resolved

There are no opposing persona verdicts. The substantive tensions are gaps between the draft design and the constraints surfaced by the reviews.

| Conflict | Persona A Position | Persona B Position | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| Awaited module entry versus classic inline execution | Architect requires parser-blocking first-script policy. | Adversary requires fail-closed guards for every later boot path. | Use both synchronous installation and guarded historical execution, asserted against final output. | A module's deferred execution cannot protect parser-executed inline scripts. |
| Source-only URLs versus evolving adapters | Architect requires adapter/build identity in the URL. | Pragmatist requires preserving published URLs and pinning source/dependency/adapter evidence. | Use source SHA plus a build fingerprint and checksum; never overwrite published packages. | Compatibility fixes must be publishable without violating immutability. |
| Native-compatible fresh storage versus restart semantics | Architect favors preserving native-shaped map contracts. | Adversary identifies lost pending settings/resume state on reload. | Keep fresh-session storage, test native-shaped transactions, and disable or clearly adapt reload-dependent archive settings. | Durable storage is explicitly unwanted; silently ineffective Apply actions are avoidable. |
| Broad snapshot delivery versus compatibility uncertainty | Pragmatist proposes an early/recent proof followed by all chapters. | Adversary requires realm/network/lifecycle checks before bulk publication. | Make the full proof the reusable acceptance gate, then deliver all approved milestones through the same pipeline. | This controls verification order without cutting scope. |

## Risk Register

| Risk | Severity | Mitigation | Owner |
| --- | --- | --- | --- |
| Classic scripts execute before policy | High | First parser-blocking bootstrap, fail-closed guards and final-output ordering assertions | Architect, Adversary |
| Workers bypass Window policy | High | Audit reachable realms; inject policy or reject unsupported workers/worklets | Adversary |
| Native storage is touched or map transactions change behavior | High | Sentinel tests plus real map union/reset/abort/epoch tests against fresh factories | Architect, Adversary, Pragmatist |
| Historical network code reaches production services | High | Disable board/analytics; explicit read-only asset allowlist plus CSP/API controls | Adversary |
| Shared github.io fallback defeats origin separation | High | Restrict archive play to its dedicated hostname and approved local hosts | Adversary |
| Start-flow adaptation breaks iOS audio | High | Retain historical synchronous gesture chain; require real-device acceptance before claiming it | Adversary |
| Current packages silently replace historical dependencies | Medium | Validate declared runtime versions and reject unsupported mismatches | Pragmatist |
| Adapter fixes conflict with immutable source-only paths | Medium | Build fingerprint in immutable package identity and pinned checksum | Architect, Adversary |
| Concurrent publishing loses snapshots | Medium | One archive-wide writer lock, atomic publication and retention checks | Architect, Pragmatist |
| Reload-dependent settings appear broken | Medium | Disable or adapt those archive-only controls and explain fresh reloads | Adversary |
| Timeline reorder leaves cart bounds stale | Medium | Reload or dispose/reinitialize the cart; pause owned animation | Pragmatist |

## Verdicts Summary

| Persona | Key Concern | Verdict |
| --- | --- | --- |
| Architect | First-script policy and complete immutable build identity | Proceed with mitigations |
| Adversary | Every executable path and realm must obey archive policy | Proceed with mitigations |
| Pragmatist | Historical bundles require real-game and storage evidence | Proceed with mitigations |
