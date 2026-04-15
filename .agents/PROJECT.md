## Project

Node/TypeScript CLI that composes an `AGENTS.md` from markdown partials held in a central Bitbucket template repo, commits and pushes the result to a tool-owned branch on each target Bitbucket Data Center repo, and — when `--pr` is passed — opens or updates a pull request for that branch. The tool never syncs itself; this file exists to model the intended per-repo pattern for downstream consumers.
