# agents-md-sync

**The problem.** Once you have more than a handful of repositories, keeping `AGENTS.md` consistent across all of them is painful. Copy-pasted instructions drift. Per-repo tweaks get lost when someone refreshes the shared boilerplate. Teams either stop updating the file or stop trusting it — either way, the AI agents working in those repos get stale or contradictory guidance.

**What this does.** `agents-md-sync` keeps `AGENTS.md` in sync across many repositories from a single central template repo. You edit shared instructions in one place; each target repo can still add its own `-CUSTOM.md` overrides that the tool never touches. Changes land as pull requests, never direct pushes, so every update is reviewable.

**How it works.** Local-git-first: all target repos and the central template repo are cloned locally under one base directory. The tool composes `AGENTS.md` from markdown partials, mirrors partials into `.agents/`, and commits once per sync on a tool-owned branch that it force-pushes to `origin`. All of this uses plain `git` against whatever remote your repos already use. A thin, pluggable adapter then opens or updates the pull request on your code host (see [PR hosting](#pr-hosting) for which hosts are wired up today).

## Model

Each target repo ends up with:

```
<target repo>/
├── AGENTS.md                 # generated; always overwritten by the tool
└── .agents/
    ├── CODING.md             # mirror of central partial; always overwritten
    ├── CODING-CUSTOM.md      # optional, repo-owned; NEVER touched by the tool
    ├── TESTING.md            # mirror of central partial; always overwritten
    ├── TESTING-CUSTOM.md     # optional, repo-owned
    └── ...
```

Ownership is explicit:
- Files without the `-CUSTOM` suffix are **tool-owned**. They mirror the central template and are overwritten on every run.
- Files with the `-CUSTOM` suffix are **repo-owned**. The tool reads them but never writes or deletes them.

`AGENTS.md` is composed by expanding `<!-- include: NAME.md -->` markers in a skeleton. For each include, the section content is:

```
<repo's NAME-CUSTOM.md, if it exists>
<blank line>
<central NAME.md>
```

CUSTOM content goes on top so repo-specific rules get read first — by humans scanning and by LLMs where earlier tokens carry more weight.

## What it does

For each target directory under your `localGitBaseDir`:

1. `git fetch origin` and hard-reset to the default branch.
2. Reads the profile skeleton + partials from the local template checkout.
3. Reads any `.agents/<NAME>-CUSTOM.md` files already present in the target checkout.
4. Composes `AGENTS.md` and mirrors partials into `.agents/`.
5. Creates/resets the local `feature/update-agents-md` branch, commits changes, force-pushes.
6. Calls the configured PR host adapter to create or update the PR.

One commit per sync. Git uses your existing credentials (SSH key or credential helper). Only the PR create/update step hits an HTTP API; see [PR hosting](#pr-hosting) for what that requires.

## Prerequisites

1. Node 20+.
2. A base directory containing local clones of:
   - the central template repo (e.g. `agents-md-templates`);
   - each target repo you want to sync.

   ```bash
   mkdir -p /Users/you/localgit
   cd /Users/you/localgit
   git clone ssh://git@bitbucket.company.com/TOOLING/agents-md-templates.git
   git clone ssh://git@bitbucket.company.com/ABC/my-spring-service.git
   # ...
   ```

3. An HTTP access token for your PR host, used only when running with `--apply`. See [PR hosting](#pr-hosting) for the env var name and token scopes.

## Install

```bash
npm install
npm run build
```

## Usage

**By default the tool never writes anything.** It composes and prints previews. Pass `--apply` to commit, push, and open PRs.

```bash
# Preview (default) — compose and print, no git writes, no push, no PR
npx agents-md-sync --config targets.json

# Actually apply: commit, force-push feature/update-agents-md, create/update PR
npx agents-md-sync --config targets.json --apply

# Open a PR even when nothing changed (requires --apply)
npx agents-md-sync --config targets.json --apply --force

# Skip the clean-working-tree check on target repos (use for ephemeral CI clones)
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
      "dir": "my-spring-service",
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

- `localGitBaseDir` — parent directory holding the template and target clones.
- `templateDir` — name of the template clone under `localGitBaseDir`.
- `bitbucketBaseUrl` — used for PR create/update.
- `prBranch` — optional; branch name the tool pushes to. Default `feature/update-agents-md`. Force-pushed on every run (tool-owned).
- Each target:
  - `dir` — directory name under `localGitBaseDir`.
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
    │   ├── AGENTS.md.tmpl
    │   └── partials/
    │       ├── CODING.md
    │       ├── TESTING.md
    │       └── BUILD.md
    └── angular/
        ├── AGENTS.md.tmpl
        └── partials/
            └── ...
```

Resolution for each `<!-- include: NAME.md -->` marker:
1. If `NAME` is in the target's `skip` → omit.
2. Else if `profiles/<profile>/partials/NAME.md` exists → use that.
3. Else if `common/NAME.md` exists → use that.
4. Else → error.

## Safety

- Default run = preview only (no git writes, no push, no PR).
- With `--apply`, the tool refuses to run against a dirty target checkout unless `--allow-dirty` is passed.
- Force-push targets the tool-owned branch `feature/update-agents-md` only; the default branch is never touched.
- Every sync commit carries an `X-AgentsMd-Sync-Source: <templateDir>@<sha>` trailer; the tool reads it on the next run to compute drift since the last sync.

## PR behavior

- Branch: `feature/update-agents-md` (force-pushed each run).
- If an open PR from that branch exists, its description is updated rather than a new PR being created.
- PR body includes included/skipped partials and the list of template commits since the last sync.

## PR hosting

Everything up to and including the `git push` of the tool-owned branch is host-agnostic and goes through plain git against whatever remote your target repos already use. The only host-specific piece is the adapter that opens or updates the pull request.

**Implemented today:**

- **Bitbucket Data Center** — uses `/rest/api/1.0/` endpoints. Requires:
  - `bitbucketBaseUrl` in `targets.json`.
  - `BITBUCKET_TOKEN` env var (HTTP access token with repo-write / PR-create scopes) when running with `--apply`.

Other hosts (GitHub, GitLab, Bitbucket Cloud) are not yet wired up. Adding one means implementing a small client with `findOpenPullRequest` / `createPullRequest` / `updatePullRequestDescription` — the rest of the pipeline doesn't care.

## Scope

- v1: one PR-host adapter implemented (Bitbucket Data Center).
- v1: markdown partials only.
- v1: one profile per target (polyglot targets are v2).
