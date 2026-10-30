# Agent Instructions — agents-md-sync

Instructions for AI coding agents working on this repository. For what the tool itself does, see `README.md`.

## Project

Node/TypeScript CLI that composes a repo's `AGENTS.md` from markdown fragments in a central template directory plus per-repo `.agents/*.md` addenda. Runs inside the target repo's CI pipeline. Writes `AGENTS.md` (and a placeholder `.agents/PROJECT.md` when missing), nothing else. No git, no PR hosts, no multi-repo config: those were removed in 1.0 and are not coming back without a design discussion.

## Stack

- TypeScript strict, Node 22+. `tsx` for dev, `tsc` for build.
- CLI: `commander`. Only runtime dependency; keep it that way.
- Tests: `vitest`. Lint: eslint + prettier.

## Coding

- No `any` without a written reason.
- Keep I/O (fs, console) at the edges in `src/run.ts`; `src/compose.ts` stays pure.
- No comments that restate the code. Only non-obvious _why_.
- No templating engine. Include markers are `<!-- include: NAME.md -->`, resolved by string replacement.
- Fragment resolution is profile-aware: `profiles/<profile>/NAME.md` wins over `common/NAME.md`. Test both paths.
- Default skeleton is the `DEFAULT_SKELETON` constant in `src/templateLoader.ts`. A profile overrides it with its own `AGENTS.md.tmpl`.
- One profile per run. Multi-profile (polyglot) is out of scope.

## Testing

- Tests live in `tests/` and mirror `src/`. Every change to `src/compose.ts` ships with a test in `tests/compose.test.ts`.
- `npm test` runs sample check, lint and vitest. Must pass before opening a PR.
- **Sample outputs are golden fixtures.** `examples/sample-output-<profile>.md` is rendered from `examples/template-repo/` plus `examples/sample-targets/<profile>/`. Fragment or header change → `npm run render:samples` and commit the result in the same change. CI fails on drift.

## Review & Git

- No direct pushes to `master`. Feature branch and PR.
- Not a fork. If that ever changes, confirm the PR target with the user before `gh pr create`.
- Commits: short imperative subject, body optional.

## Do not

- Do not add git operations, PR-host clients or multi-repo config.
- Do not write anything under a target's `.agents/` except the `PROJECT.md` scaffold.
- Do not commit secrets or real template/target paths.
- Do not skip pre-commit hooks (`--no-verify`) without explicit user approval.
