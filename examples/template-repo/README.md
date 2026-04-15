# agents-md-templates

Central template repo consumed by [`agents-md-sync`](https://www.npmjs.com/package/agents-md-sync) to keep `AGENTS.md` in sync across many target repositories.

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
