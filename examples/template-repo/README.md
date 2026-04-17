# agents-md-templates

Central template repo consumed by [`agents-md-sync`](https://www.npmjs.com/package/agents-md-sync) to keep `AGENTS.md` in sync across many target repositories.

## What this does

For each target repo, `agents-md-sync` generates an `AGENTS.md` by combining two sources:

1. **Central partials from this template directory** (`common/` + `profiles/<profile>/`) — the shared, per-stack instructions maintained in one place.
2. **Per-target addenda from the target repo's `.agents/` directory** (optional) — repo-specific rules the target's maintainers want layered on top.

For every `<!-- include: NAME.md -->` marker in the skeleton, the tool looks for:
- a matching `.agents/NAME.md` in the target repo (local addendum), and
- a matching `NAME.md` in this template directory (central baseline).

If both exist, the local addendum is **prepended** to the central version — so repo-specific rules appear first (humans scanning top-down see them first, LLMs give earlier tokens more weight). If only one exists, that one is used alone. The generated `AGENTS.md` is tool-owned and overwritten on every sync; the `.agents/` files are repo-owned and never touched by the tool.

Net effect: you edit shared instructions once in this template repo, and each target's `AGENTS.md` reflects both the central baseline *and* whatever local addenda that target has added.

## Layout

```
.
├── common/                # shared partials — apply to every profile
│   ├── REVIEW.md
│   └── DO_NOT.md
└── profiles/              # one directory per tech stack
    ├── spring-boot-maven/
    │   ├── CODING.md
    │   ├── TESTING.md
    │   └── BUILD.md
    └── angular/
        ├── CODING.md
        ├── TESTING.md
        └── BUILD.md
```

Partial resolution for each `<!-- include: NAME.md -->` marker in the skeleton:

1. If `NAME` is in the target's `skip` list → omit.
2. If the target's `.agents/NAME.md` exists → prepended to the central version.
3. Else `profiles/<profile>/NAME.md` if present.
4. Else `common/NAME.md` if present.
5. Else error.

`PROJECT.md` has no central default — every target repo must ship its own `.agents/PROJECT.md`.

## Skeleton

`agents-md-sync` ships a default `AGENTS.md.tmpl` that includes `PROJECT`, `CODING`, `TESTING`, `BUILD`, `REVIEW`, `DO_NOT` in that order. Drop an `AGENTS.md.tmpl` into a profile directory only when you need to override the section set or ordering for that single profile.

## Install the sync tool

Node 22+ required.

```bash
# Run without installing (recommended — always picks up the latest version)
npx agents-md-sync --config targets.json

# Or install globally
npm install -g agents-md-sync
```

## Run

By default the tool only previews — no git writes, no push, no PR. Pass `--apply` to commit and force-push the tool-owned branch; add `--pr` to also open or update a pull request.

```bash
# Preview what AGENTS.md would look like for every target
npx agents-md-sync --config targets.json

# Commit and force-push feature/update-agents-md on each target
npx agents-md-sync --config targets.json --apply

# Also open or update the PR via the configured host adapter
npx agents-md-sync --config targets.json --apply --pr
```

See the upstream [`agents-md-sync` README](https://github.com/trick77/agents-md-sync) for flags, safety rules (`--autostash`, `--allow-dirty`), and PR-host configuration.

## Minimal `targets.json`

```json
{
  "localGitBaseDir": "/Users/you/localgit",
  "templateDir": "agents-md-templates",
  "bitbucketBaseUrl": "https://bitbucket.example.com",
  "targets": [
    { "dir": "my-spring-service", "profile": "spring-boot-maven" },
    { "dir": "my-angular-app",    "profile": "angular" }
  ]
}
```

`localGitBaseDir` is where the tool expects to find `templateDir` and each `targets[].dir`. Absolute paths in `dir` also work.
