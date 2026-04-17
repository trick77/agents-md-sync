# agents-md-sync

[![CI](https://img.shields.io/github/actions/workflow/status/trick77/agents-md-sync/ci.yaml?branch=master&label=CI)](https://github.com/trick77/agents-md-sync/actions/workflows/ci.yaml)
[![npm](https://img.shields.io/npm/v/agents-md-sync)](https://www.npmjs.com/package/agents-md-sync)
[![node](https://img.shields.io/node/v/agents-md-sync)](https://www.npmjs.com/package/agents-md-sync)

**The problem.** Once you have more than a handful of repositories, keeping `AGENTS.md` consistent across all of them is painful. Copy-pasted instructions drift, and per-repo tweaks get lost when someone refreshes the shared boilerplate. Teams either stop updating the file or stop trusting it — either way, the AI agents working in those repos get stale or contradictory guidance.

**What this does.** `agents-md-sync` keeps `AGENTS.md` in sync across many repositories from a single central template repo. You edit shared instructions in one place; each target repo can still add its own per-section addenda under `.agents/` that the tool never touches.

**How it works.** Local-first: the tool operates on a local directory of template partials plus whatever local working copies of the target repos you already have on disk — the same checkouts you use for daily development are fine. It composes `AGENTS.md` from markdown partials and commits once per sync on a tool-owned branch that it force-pushes to `origin`. A thin, pluggable adapter then opens or updates the pull request on your code host (see [PR hosting](#pr-hosting) for which hosts are wired up today).

## Model

Each target repo ends up with:

```
<target repo>/
├── AGENTS.md                 # generated; always overwritten by the tool
└── .agents/                  # optional; 100% repo-owned, never written by the tool
    ├── CODING.md             # optional addendum to the central CODING partial
    ├── TESTING.md            # optional addendum to the central TESTING partial
    └── ...
```

Ownership is explicit:
- `AGENTS.md` is **tool-owned**. It is overwritten on every run.
- Everything under `.agents/` is **repo-owned**. The tool reads these files as addenda when composing `AGENTS.md`, but never writes or deletes them.

`AGENTS.md` is composed by expanding `<!-- include: NAME.md -->` markers in a skeleton. For each include, the section content is:

```
<repo's .agents/NAME.md, if it exists>
<blank line>
<central NAME.md>
```

The local addendum goes on top so repo-specific rules get read first — by humans scanning and by LLMs where earlier tokens carry more weight.

## What it does

For each target working copy listed in the config:

1. `git fetch origin` and hard-reset to the default branch.
2. Reads the profile skeleton + partials from the local template directory.
3. Reads any `.agents/<NAME>.md` files already present in the target checkout and treats them as per-section addenda.
4. Composes `AGENTS.md`.
5. Creates/resets the local `feature/update-agents-md` branch, commits changes, force-pushes.
6. If `--pr` is passed, calls the configured PR host adapter to create or update the pull request. Otherwise the sync stops after the push.

One commit per sync. Git uses your existing credentials (SSH key or credential helper). Only the PR create/update step hits an HTTP API; see [PR hosting](#pr-hosting) for what that requires.

## Prerequisites

1. Node 22+.
2. A local directory containing the template partials (see [Template repo layout](#template-repo-layout)). It doesn't need to be a git repo — a plain folder works. Versioning it in git is recommended for teams, but not required by the tool.
3. Local working copies of each target repo on the same machine where the tool runs. Each target must be a git working copy, since the sync commits `AGENTS.md` and force-pushes it. If you already have them checked out for normal work, use those paths directly — the tool does no cloning.
4. An HTTP access token for your PR host, used only when running with `--apply --pr`. See [PR hosting](#pr-hosting) for the env var name and token scopes.

## Install

```bash
# Run without installing (recommended — always fetches the latest version)
npx agents-md-sync --config targets.json

# Or install globally
npm install -g agents-md-sync
```

To work on the tool itself, see [From source](#from-source).

## Usage

**By default the tool never writes anything.** The default run is a preview that prints a concise per-target summary (what would be written, which partials were included/skipped/addenda'd) and no file content. Pass `--apply` to commit and push; `--pr` to also open or update a pull request.

Run with no arguments to see usage and examples:

```bash
npx agents-md-sync
```

```bash
# Preview (default) — per-target summary; no writes.
npx agents-md-sync --config targets.json

# Preview and also dump the full composed AGENTS.md for each target.
npx agents-md-sync --config targets.json --show-output

# Commit and force-push feature/update-agents-md — no PR is opened
npx agents-md-sync --config targets.json --apply

# Commit, push, and create/update the PR (requires BITBUCKET_TOKEN)
npx agents-md-sync --config targets.json --apply --pr

# Open a PR even when nothing changed (requires --apply --pr)
npx agents-md-sync --config targets.json --apply --pr --force

# Auto-stash local changes before sync and restore them after (dev machines)
npx agents-md-sync --config targets.json --apply --autostash

# Skip the clean-working-tree check entirely (ephemeral CI clones only — uncommitted changes WILL be discarded)
npx agents-md-sync --config targets.json --apply --allow-dirty
```

## Config (`targets.json`)

```json
{
  "localGitBaseDir": "/Users/you/localgit",
  "templateDir": "agents-md-templates",
  "bitbucketBaseUrl": "https://bitbucket.company.com",
  "prBranch": "feature/update-agents-md",
  "targets": [
    {
      "dir": "/Users/you/code/my-spring-service",
      "profile": "spring-boot-maven"
    },
    {
      "dir": "my-gradle-service",
      "profile": "spring-boot-gradle",
      "skip": ["TESTING"]
    }
  ]
}
```

- `localGitBaseDir` — base directory used only to resolve relative `dir` entries below. Absolute paths in `dir` ignore it.
- `templateDir` — path to the template directory. Relative to `localGitBaseDir`, or absolute. Doesn't need to be a git repo.
- `bitbucketBaseUrl` — used for PR create/update.
- `prBranch` — optional; branch name the tool pushes to. Default `feature/update-agents-md`. Force-pushed on every run (tool-owned).
- Each target:
  - `dir` — path to the target working copy. Relative to `localGitBaseDir`, or absolute.
  - `profile` — selects `profiles/<name>/` in the template repo.
  - `skip` — optional list of partial names to omit.

The default branch for each target is detected from its local clone (`git symbolic-ref refs/remotes/origin/HEAD`); no per-target `branch` field is needed.

## Template repo layout

Partials are organized by **profile** (one per tech stack). Shared partials live in `common/`.

```
agents-md-templates/
├── common/
│   ├── REVIEW.md
│   └── DO_NOT.md
└── profiles/
    ├── spring-boot-maven/
    │   ├── CODING.md
    │   ├── TESTING.md
    │   └── BUILD.md
    └── angular/
        └── ...
```

A profile's identity is its partials (`CODING.md` / `TESTING.md` / `BUILD.md`), not how they are ordered in the rendered output. The tool ships a default `AGENTS.md.tmpl` skeleton that includes `PROJECT`, `CODING`, `TESTING`, `BUILD`, `REVIEW`, and `DO_NOT` in that order — so profiles normally contain only partials. Drop an `AGENTS.md.tmpl` into a profile directory only when you want to override the default ordering or section set for that one profile.

Every target repo must provide its own `.agents/PROJECT.md`. `PROJECT` is the root section of the rendered `AGENTS.md` — it describes what the service does and is inherently per-repo, so there is no central default. Sync fails loudly if it's missing.

Any `*.md` file in the target's `.agents/` directory becomes an available partial, regardless of whether the central template defines one with the same name. This lets targets both override central partials and add their own (like `PROJECT`).

Resolution for each `<!-- include: NAME.md -->` marker:
1. If `NAME` is in the target's `skip` → omit.
2. If the target's `.agents/NAME.md` exists, its content is prepended to the central version (or used alone if there is no central version).
3. Else if `profiles/<profile>/NAME.md` exists → use that.
4. Else if `common/NAME.md` exists → use that.
5. Else → error.

Write partials **for the agent**, not for humans. Every line should shape a decision the agent actually makes while writing or pushing code — constraints on tools, tests, dependencies, commit hygiene. Human-workflow items like "PRs need one approving review" or "keep diffs under 400 lines" belong in `CONTRIBUTING.md` or branch-protection rules; in an `AGENTS.md` they just burn context window. The example partials under `examples/template-repo/` show the intended shape.

## Safety

- Default run = preview only (no git writes, no push, no PR).
- With `--apply`, the tool refuses to run against a dirty target checkout unless `--autostash` or `--allow-dirty` is passed.
  - `--autostash` (recommended for dev machines): runs `git stash push --include-untracked` before touching the repo, restores the original branch and pops the stash in a `finally` block. If pop fails (extremely unlikely, since `AGENTS.md` is tool-owned and unlikely to collide with your work), your changes remain safely in `git stash list`.
  - `--allow-dirty` (CI only): skips the check and lets the default-branch hard reset proceed — **destructive to uncommitted work**.
- Force-push targets the tool-owned branch `feature/update-agents-md` only; the default branch is never touched.
- Each sync regenerates `AGENTS.md` from the current template state. There is no drift bookkeeping — the PR diff of `AGENTS.md` itself is the record of what changed.

## PR behavior

- `--apply` alone commits and force-pushes the tool-owned branch `feature/update-agents-md`, but does **not** open or touch any pull request. No host API token is required.
- `--apply --pr` additionally opens a PR from that branch, or updates the description of an existing open PR instead of creating a duplicate. This step requires `BITBUCKET_TOKEN`.
- PR body lists the included/skipped partials and names the template directory the sync was composed from. The PR diff of `AGENTS.md` itself shows exactly what changed.

## PR hosting

Everything up to and including the `git push` of the tool-owned branch is host-agnostic and goes through plain git against whatever remote your target repos already use. The only host-specific piece is the adapter that opens or updates the pull request.

**Implemented today:**

- **Bitbucket Data Center** — uses `/rest/api/1.0/` endpoints. Requires:
  - `bitbucketBaseUrl` in `targets.json`.
  - `BITBUCKET_TOKEN` env var (HTTP access token with repo-write / PR-create scopes) when running with `--apply --pr`.

Other hosts (GitHub, GitLab, Bitbucket Cloud) are not yet wired up. Adding one means implementing a small client with `findOpenPullRequest` / `createPullRequest` / `updatePullRequestDescription` — the rest of the pipeline doesn't care.

## Scope

- v1: one PR-host adapter implemented (Bitbucket Data Center).
- v1: markdown partials only.
- v1: one profile per target (polyglot targets are v2).

## From source

```bash
git clone https://github.com/trick77/agents-md-sync.git
cd agents-md-sync
npm install
npm run build
npx tsx src/index.ts --config targets.json
```

## Releasing

1. Bump `version` in `package.json` and commit.
2. Create a GitHub Release with tag `vX.Y.Z` (must match `package.json`).
3. The Release workflow publishes to npm with provenance.
