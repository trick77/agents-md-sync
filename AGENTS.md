# Agent Instructions — agents-md-sync

Instructions for AI coding agents working on this repository. For what the tool itself does, see `README.md`.

## Project

Node/TypeScript CLI that composes an `AGENTS.md` from markdown partials held in a central Bitbucket template repo and opens pull requests against target Bitbucket Data Center repos. Greenfield — currently only README and this file exist.

## Stack

- **Language:** TypeScript, Node 20+
- **Runner:** `tsx` for dev, `tsc` for build
- **CLI:** `commander`
- **Validation:** `zod`
- **HTTP:** `undici` (or built-in `fetch`)
- **Tests:** `vitest`

## Coding

- TypeScript strict mode. No `any` without a written reason.
- Prefer small, pure functions. Keep I/O (Bitbucket API, fs) at the edges; keep composition logic pure so it can be unit-tested without network.
- No comments that restate the code. Only comment non-obvious *why*.
- Use Node's built-in `fetch` unless a specific `undici` feature is needed.
- Do NOT introduce a heavy templating engine. Include markers are `<!-- include: NAME.md -->` and are resolved by simple string replacement.
- Partial resolution is profile-aware: `profiles/<profile>/partials/NAME.md` wins over `common/NAME.md`. Keep `compose.ts` pure and test both paths.
- v1 allows exactly ONE profile per target. Multi-profile (polyglot) support is out of scope. Do not add it without a design discussion.

## Testing

- Unit tests go in `tests/` and mirror `src/` layout.
- `src/compose.ts` MUST be covered by unit tests — it is the only pure-logic module and the heart of the tool.
- Network-touching code (`src/bitbucket.ts`, `src/sync.ts`) is tested via mocked `fetch` or integration tests against a sandbox repo, never against real production Bitbucket repos.
- Run tests with `npm test` (vitest). Every PR must pass tests locally before opening.
- **Sample outputs are golden fixtures.** `examples/sample-output-<profile>.md` is re-rendered on every build and test run by composing each profile in `examples/template-repo/profiles/` against `examples/template-repo/common/`. `npm run build` and `npm test` both invoke the render step. If a profile partial changes, the sample file must be updated in the same commit. CI fails if committed samples drift from what `compose.ts` produces.

## Review & Git

- No direct pushes to `master`/`main`. Always work on a feature branch and open a PR.
- This repo is NOT a fork. Standard PR targeting applies — but if that ever changes, confirm the PR target with the user before running `gh pr create`.
- Commits: short imperative subject line, body optional. No Conventional Commits requirement yet.

## Build & Run

```bash
npm install
npm run build          # tsc to dist/
npx tsx src/index.ts --config examples/targets.json --dry-run
```

## Bitbucket API notes

- Target is **Bitbucket Data Center** (self-hosted). API base: `/rest/api/1.0/`. Do NOT use Bitbucket Cloud endpoints (`/2.0/`).
- Auth: `Authorization: Bearer $BITBUCKET_TOKEN`.
- File write is `PUT /projects/{key}/repos/{slug}/browse/{path}` with multipart form fields `content`, `message`, `branch`, `sourceCommitId`.
- When the PR branch already exists, update it — do not create a second branch.

## Do not

- Do not push directly to `master`/`main`.
- Do not commit secrets, tokens, or `targets.json` files that contain real Bitbucket URLs/credentials. Add a `.env` and `examples/targets.json` with dummy values only.
- Do not touch any file in a target repo's `.agents/` directory that matches `*-CUSTOM.md`. Those are repo-owned. The base `.agents/<NAME>.md` files ARE tool-owned and should be overwritten on every run.
- Do not skip pre-commit hooks (`--no-verify`) or Git signing without explicit user approval.
- Do not add support for Bitbucket Cloud or GitHub in v1 — it's out of scope.
