<p>
  <img src="logo.svg" alt="agents-md-sync" width="720">
</p>

[![CI](https://img.shields.io/github/actions/workflow/status/trick77/agents-md-sync/ci.yaml?branch=master&label=CI)](https://github.com/trick77/agents-md-sync/actions/workflows/ci.yaml)
[![node](https://img.shields.io/node/v/agents-md-sync)](https://www.npmjs.com/package/agents-md-sync)

**The problem.** Once you have more than a handful of repositories, keeping `AGENTS.md` consistent across all of them is painful. Copy-pasted instructions drift, and per-repo tweaks get lost when someone refreshes the shared boilerplate. Teams either stop updating the file or stop trusting it, and the AI agents working in those repos get stale or contradictory guidance.

**What this does.** `agents-md-sync` composes a repo's `AGENTS.md` from markdown fragments kept in one central template directory, plus optional per-repo addenda under `.agents/`. Run it in each repo's pipeline and every `AGENTS.md` follows the shared template while keeping its local additions. The tool writes one file and does nothing with git; committing the result is the pipeline's job.

## Model

Each repo ends up with:

```
<repo>/
├── AGENTS.md                 # generated; overwritten on every run
└── .agents/                  # repo-owned
    ├── PROJECT.md            # required; scaffolded with a placeholder if missing
    ├── CODING.md             # optional addendum to the central CODING fragment
    ├── TESTING.md            # optional addendum to the central TESTING fragment
    └── ...
```

- `AGENTS.md` is **tool-owned** and regenerated on every run.
- `.agents/` is **repo-owned**. The tool reads these files as addenda. The only file it ever creates there is a placeholder `PROJECT.md` when none exists.

`AGENTS.md` is composed by expanding `<!-- include: NAME.md -->` markers in a skeleton. For each include, the section content is:

```
<repo's .agents/NAME.md, if it exists>
<blank line>
<central NAME.md>
```

The local addendum goes on top so repo-specific rules get read first, by humans scanning and by LLMs where earlier tokens carry more weight.

## Usage

Node 22+.

```bash
# Compose AGENTS.md into the current repo.
npx agents-md-sync --template-dir ../agents-md-templates --profile spring-boot-maven

# CI gate: exit 1 if the committed AGENTS.md differs from what would be composed.
npx agents-md-sync --template-dir ../agents-md-templates --profile spring-boot-maven --check
```

| Flag                    | Meaning                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `--template-dir <path>` | Central template directory (required).                                 |
| `--profile <name>`      | Profile under `<template-dir>/profiles/` (required).                   |
| `--repo <dir>`          | Target repo. Default: current directory.                               |
| `--skip <name>`         | Omit a fragment. Repeatable.                                           |
| `--check`               | Compare with the existing `AGENTS.md`, write nothing, exit 1 on drift. |

Exit codes: 0 success or up to date, 1 drift under `--check` or any error.

Warnings go to stderr: a `.agents/*.md` file or `--skip` name that matches no include in the skeleton, and a composed file above 12 KB (long instruction files degrade agent behavior).

### In a pipeline

The template directory does not need to be a git repo, but versioning it is the point. Check it out next to the target and run the tool.

```yaml
# GitHub Actions example; the same two commands work in any CI.
- uses: actions/checkout@v7
- uses: actions/checkout@v7
  with:
    repository: your-org/agents-md-templates
    path: .agents-md-templates
- run: npx agents-md-sync --template-dir .agents-md-templates --profile spring-boot-maven
- run: git add AGENTS.md .agents/PROJECT.md && git diff --cached --quiet || git commit -m "chore: update AGENTS.md"
```

Use `--check` in a pull-request job to fail the build when someone hand-edits `AGENTS.md` or the template moved on.

## Template directory layout

Fragments are organized by **profile** (one per tech stack). Shared fragments live in `common/`.

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

The tool ships a default skeleton that includes `PROJECT`, `CODING`, `TESTING`, `BUILD`, `REVIEW` and `DO_NOT` in that order, so profiles normally contain only fragments. Drop an `AGENTS.md.tmpl` into a profile directory only when that profile needs a different section set or ordering.

`PROJECT` is the root section and inherently per-repo, so there is no central default. Every repo provides `.agents/PROJECT.md`; on the first run the tool scaffolds a placeholder for you to fill in.

Any `*.md` file in the repo's `.agents/` directory becomes an available fragment, whether or not the central template defines one with the same name.

Resolution for each `<!-- include: NAME.md -->` marker:

1. `NAME` passed via `--skip` → omitted.
2. `.agents/NAME.md` exists → prepended to the central version, or used alone if there is none.
3. Else `profiles/<profile>/NAME.md` if present.
4. Else `common/NAME.md` if present.
5. Else error.

Write fragments **for the agent**, not for humans. Every line should shape a decision the agent actually makes while writing or pushing code: constraints on tools, tests, dependencies, commit hygiene. Human-workflow items like "PRs need one approving review" belong in `CONTRIBUTING.md` or branch-protection rules; in an `AGENTS.md` they just burn context window. The example fragments under `examples/template-repo/` show the intended shape, and `examples/sample-output-*.md` show what they compose to.

## From source

```bash
git clone https://github.com/trick77/agents-md-sync.git
cd agents-md-sync
npm install
npm test
npm run build
node dist/index.js --template-dir examples/template-repo --profile angular --repo /path/to/repo
```

## Releasing

1. Bump `version` in `package.json` and commit.
2. Create a GitHub Release with tag `vX.Y.Z` (must match `package.json`).
3. The Release workflow publishes to npm with provenance.
