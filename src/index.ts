#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { buildConfig } from "./config.js";
import { run } from "./run.js";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

const EXAMPLES = `
Examples:
  # Compose AGENTS.md into the current repo.
  agents-md-sync --template-dir ../agents-md-templates --profile spring-boot-maven

  # CI gate: exit 1 if the committed AGENTS.md differs from what would be composed.
  agents-md-sync --template-dir ../agents-md-templates --profile spring-boot-maven --check

Layout of the template directory and the per-repo .agents/ addenda:
  https://github.com/trick77/agents-md-sync#readme
`;

async function main(): Promise<void> {
  const program = new Command()
    .name("agents-md-sync")
    .description("Compose AGENTS.md from a central template directory and per-repo .agents/ addenda.")
    .version(pkg.version)
    .requiredOption("--template-dir <path>", "central template directory")
    .requiredOption("--profile <name>", "profile under <template-dir>/profiles/")
    .option("--repo <dir>", "target repo directory", ".")
    .option("--skip <name>", "fragment to omit (repeatable)", collect, [])
    .option("--check", "compare with the existing AGENTS.md and write nothing; exit 1 on drift", false)
    .addHelpText("after", EXAMPLES)
    .showHelpAfterError();

  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }

  program.parse(process.argv);
  const opts = program.opts<{
    templateDir: string;
    profile: string;
    repo: string;
    skip: string[];
    check: boolean;
  }>();

  const cfg = buildConfig({
    repo: opts.repo,
    templateDir: opts.templateDir,
    profile: opts.profile,
    skip: opts.skip,
  });

  const status = await run(cfg, { check: opts.check });
  if (status === "out-of-date") process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
