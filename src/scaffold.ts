import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { logger } from "./logger.js";

const SCAFFOLD_CONTENT: Record<string, string> = {
  PROJECT: `## Project {{projectName}}

<!-- Describe your project here: what it does, its domain, who uses it, key
     performance constraints, and anything else an AI agent should know before
     touching the code. -->
`,
  CODING: `## Coding

<!-- List your coding standards here: language idioms, patterns to use or
     avoid, formatting/linting tools, naming conventions, and import rules. -->
`,
  TESTING: `## Testing

<!-- Describe your testing strategy: test runner, naming conventions, where
     tests live, how to run them locally, mocking approach, and coverage
     expectations. -->
`,
  BUILD: `## Build

<!-- Add build, run, and deploy commands here. Include any environment setup
     steps, required secrets, and how to verify a successful build. -->
`,
  REVIEW: `## Review

- One logical change per PR — do not bundle refactors with feature work.
- Include tests for new behavior in the same PR that introduces it.
- Do not force-push shared branches. Force-push is only acceptable on
  your own feature branch.
- Resolve merge conflicts by inspecting both sides; never drop changes
  to "just make it compile".
`,
  DO_NOT: `## Do Not

- Do not commit secrets, tokens, or credentials. Use the project's secret manager.
- Do not push directly to \`main\`/\`master\`.
- Do not skip pre-commit hooks (\`--no-verify\`) or signing flags without explicit approval.
- Do not delete or rewrite commits on shared branches.
- Do not disable tests to make CI green. Fix the test or the code.
- Do not add new runtime dependencies without flagging the addition in
  the PR description. Prefer the standard library or packages already
  present in the project.
`,
};

function scaffoldContent(name: string, projectName: string): string {
  const template =
    SCAFFOLD_CONTENT[name] ??
    `## ${name}\n\n<!-- Add content for ${name} here. -->\n`;
  return template.replace(/\{\{projectName\}\}/g, projectName);
}

export async function scaffoldMissingPartials(
  targetDir: string,
  missing: string[],
): Promise<void> {
  const agentsDir = resolve(targetDir, ".agents");
  await mkdir(agentsDir, { recursive: true });
  const projectName = basename(resolve(targetDir));
  for (const name of missing) {
    const filePath = resolve(agentsDir, `${name}.md`);
    await writeFile(filePath, scaffoldContent(name, projectName), "utf8");
    logger.info(`  scaffolded .agents/${name}.md`);
  }
}
