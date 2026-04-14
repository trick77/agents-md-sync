## Do Not

- Do not commit secrets, tokens, or credentials. Use the project's secret manager.
- Do not push directly to `main`/`master`.
- Do not skip pre-commit hooks (`--no-verify`) or signing flags without explicit approval.
- Do not delete or rewrite commits on shared branches.
- Do not disable tests to make CI green. Fix the test or the code.
- Do not introduce dependencies without checking license and the project's approved-libs policy.
