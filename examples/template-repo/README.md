# agents-md-templates

Central template repo consumed by [`agents-md-sync`](https://www.npmjs.com/package/agents-md-sync) to keep `AGENTS.md` in sync across many target repositories.

## Authoring partials — keep them minimal

A February 2026 ETH Zurich / LogicStar.ai study ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988)) evaluated `AGENTS.md` against SWE-bench and a novel benchmark of real developer-committed context files. Headline findings:

- Context files **reduced** task success rates compared to providing no repo context at all.
- They raised inference cost by **>20%** (re-sent on every API call).
- Codebase overviews and directory listings did not help — agents discover structure on their own; reading a manual listing burns reasoning tokens.
- Both LLM-generated and human-written files pushed agents into unnecessary exploration (extra testing, file traversal) because agents follow the instructions they're given.
- The authors' guidance: *"human-written context files should describe only minimal requirements."*

What this means for partials in this repo:

- **Steering only.** Do/don't rules, conventions, non-obvious build/test commands, project-specific gotchas. Imperative voice.
- **No file catalogs, directory trees, or architecture overviews.** Anything an agent could derive from `ls`, `grep`, or reading the code is dead weight.
- **No LLM-generated prose.** Hand-written and short.
- **One topic per partial** (CODING, TESTING, BUILD, …) so targets can `skip` what doesn't apply.
- Aim for a tight character budget per partial; the merged `AGENTS.md` is loaded on every turn.

### Caveat: the study only measures task-completion agents

The ETH study evaluates whether `AGENTS.md` helps an autonomous coding agent close issues on SWE-bench. It does **not** evaluate the other common use of these files: giving context to **non-coding agents** in the same repo — review agents, security-review agents, refactor advisors, doc generators, PR triage bots. Those agents aren't measured by patch-correctness on a benchmark; they need to know the project's conventions to give useful judgments, and an empty `AGENTS.md` makes them generic.

Practical reading: keep partials minimal for the sake of the coding agent, but don't strip out the conventions a reviewer would need to flag a violation. Rules a review agent would cite (`testee` naming, AssertJ-only, Swiss orthography, "don't push to master") earn their tokens even if a coding agent could have completed the task without them.

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
