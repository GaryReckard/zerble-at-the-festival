# graphify — codebase knowledge graph (local-only)

[graphify](https://github.com/safishamsi/graphify) turns this repo into a queryable
knowledge graph the AI assistant uses to answer **structural** questions — "how does
the chunk system load/unload?", "what touches the registry?", "how do `Crowd` and
`Registry` connect?" — at a fraction of the tokens of grepping.

## The model: local-only, never committed

`graphify-out/` is **git-ignored** — it is NOT in the repo (this is a solo side-project;
there's no shared seed to distribute). It's built once locally, then git hooks rebuild it
incrementally. We chose local-only deliberately: committing `graph.json` causes merge
conflicts (LLM non-determinism) and a dirty-tree loop with the rebuild hooks
(graphify issues [#369](https://github.com/safishamsi/graphify/issues/369),
[#1018](https://github.com/safishamsi/graphify/issues/1018)).

## Setup (one-time, on a fresh clone / new machine)

```sh
uv tool install graphifyy            # the CLI (note the double-y package name)
/graphify                            # build the graph (LLM tokens for the doc layer; honors .graphifyignore)
```

Then install the **doc-safe** hooks (do NOT just run `graphify hook install` — see the warning):

```sh
graphify hook install                                  # writes post-commit (safe) + post-checkout (NOT safe)
# derive an incremental post-merge from post-commit (preserves the doc layer on pulls):
sed -e 's#git diff --name-only HEAD~1 HEAD#git diff --name-only ORIG_HEAD HEAD#' \
    -e 's#after each commit#after each pull/merge#' \
    .git/hooks/post-commit > .git/hooks/post-merge && chmod +x .git/hooks/post-merge
rm -f .git/hooks/post-checkout                          # delete the full-rebuild hook (it clobbers docs)
```

> ⚠️ **Never run `graphify hook install` and leave it.** Its `post-checkout` does a *full*
> rebuild on every branch switch, and an AST-only rebuild can't regenerate the LLM semantic
> doc layer — it silently replaces concepts/rationale with raw markdown headings (verified:
> a full rebuild dropped the concept/rationale count to 0). Keep `post-commit` + `post-merge`
> (both incremental — they preserve unchanged nodes, including docs) and delete `post-checkout`.
> Likewise don't run `graphify claude install` — it writes the committed CLAUDE.md /
> .claude/settings.json and reinstalls the doc-killing post-checkout.

Per-dev steering lives in the git-ignored `CLAUDE.local.md` and `.claude/settings.local.json`
(a non-blocking PreToolUse hook that nudges `grep` → `graphify query` when the graph exists).

## Using it

- `graphify query "Chunks"` — neighborhood around a node (query by **vocabulary**, not prose:
  raw prose like "how does the world load" can latch onto the wrong token and return noise).
- `graphify path "Crowd" "Registry"` — shortest connection between two things.
- `graphify explain "ChunkManager"` — what a node is and what it touches.
- `graphify-out/GRAPH_REPORT.md` — god nodes / communities / surprising links.
- `graphify export html` — regenerate `graph.html` (the visual; not kept around by default).

Best for relational/architecture questions. For "what's on line 50 of foo.js?", just read the file.

## Keeping it fresh

- **Code → automatic.** `post-commit` + `post-merge` rebuild incrementally on every commit and
  pull (AST-only, free, background; the doc layer is preserved).
- **Docs → manual.** After editing tracked docs (ARCHITECTURE, README, the rules, openspec/specs,
  CHANGELOG…), run `/graphify --update` to refresh the semantic doc layer (LLM, changed docs only).
- **After a major change**, prompt Gary to run `/graphify --update`. Check staleness anytime by
  comparing `graph.json`'s `built_at_commit` to `git rev-parse HEAD`.

## Scope

`.graphifyignore` (committed) locks the graph to **code + project docs**: `src/` (+ models,
worldgen), `bin/`, the HTML entry points, and the docs (ARCHITECTURE, CLAUDE, README, ROADMAP,
CHANGELOG, DEBUGGING, PLAN, `.claude/{agents,commands,rules}` + design notes, `openspec/specs`,
`openspec/schemas`, `verification/`). **Excluded on purpose:** `openspec/changes/` (~140 process
artifacts), `.claude/skills/` (generic three.js packs), and images except the architecture diagram.
It's a **blacklist** — graphify does NOT honor the "ignore `/*` then re-include with `!`" whitelist
pattern (it returns zero files). Widen scope by deleting an exclude line.

## Gotchas (learned the hard way)

- Driving graphify's library directly (hand-rolled rebuilds) from a `python - <<EOF` heredoc
  **crashes** — its AST extractor uses spawn multiprocessing, which re-imports the entrypoint and
  can't find `<stdin>`. Run from a real `.py` file with an `if __name__ == '__main__':` guard, or
  pass `parallel=False` to `extract()`.
- A hand-rolled rebuild that omits `root=<repo>` bakes absolute machine paths into `graph.json`
  (and `build_from_json` relativizes nodes/edges but **not** hyperedges — strip those separately).
  The hooks installed above use the standard CLI path, which handles this correctly.
