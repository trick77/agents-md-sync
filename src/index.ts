#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { BitbucketClient } from "./bitbucket.js";
import { loadConfig } from "./config.js";
import { logger, setLevel } from "./logger.js";
import { syncAll } from "./sync.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
const VERSION = pkg.version;

function printUsage(program: Command): void {
  process.stdout.write(program.helpInformation());
  process.stdout.write(
    [
      "",
      "Examples:",
      "  # Preview (default) — prints a per-target summary; no writes.",
      "  agents-md-sync --config targets.json",
      "",
      "  # Preview and also dump the full composed AGENTS.md for each target.",
      "  agents-md-sync --config targets.json --show-output",
      "",
      "  # Commit and force-push feature/update-agents-md. No PR is opened.",
      "  agents-md-sync --config targets.json --apply",
      "",
      "  # Commit, push, and create/update the PR (requires BITBUCKET_TOKEN).",
      "  agents-md-sync --config targets.json --apply --pr",
      "",
      "  # Open a PR even when nothing changed.",
      "  agents-md-sync --config targets.json --apply --pr --force",
      "",
      "  # Auto-stash local changes before sync and restore them after.",
      "  agents-md-sync --config targets.json --apply --autostash",
      "",
      "Getting started:",
      "  Create a targets.json listing your local template directory and target",
      "  working copies. See https://github.com/trick77/agents-md-sync#config-targetsjson",
      "  for the full schema.",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  logger.info(`agents-md-sync ${VERSION}`);

  const program = new Command();
  program
    .name("agents-md-sync")
    .description("Generate and sync AGENTS.md across locally-cloned Bitbucket repos.")
    .version(VERSION)
    .option("-c, --config <path>", "path to targets.json")
    .option("--apply", "actually commit and push. Default is preview only.", false)
    .option("--pr", "open or update a pull request after pushing (requires --apply)", false)
    .option("--force", "open a PR even when nothing changed (requires --apply --pr)", false)
    .option("--show-output", "in preview mode, also print the full composed AGENTS.md for each target", false)
    .option("--allow-dirty", "skip the clean-working-tree check on target repos (destructive: uncommitted changes are discarded by the default-branch reset)", false)
    .option("--autostash", "stash local changes before sync and pop them after (safe alternative to --allow-dirty)", false)
    .option("-v, --verbose", "enable debug logging", false);

  program.parse(process.argv);
  const opts = program.opts<{
    config?: string;
    apply: boolean;
    pr: boolean;
    force: boolean;
    showOutput: boolean;
    allowDirty: boolean;
    autostash: boolean;
    verbose: boolean;
  }>();

  if (!opts.config) {
    printUsage(program);
    return;
  }

  if (opts.verbose) setLevel("debug");

  if (!opts.apply) {
    const ignored: string[] = [];
    if (opts.pr) ignored.push("--pr");
    if (opts.force) ignored.push("--force");
    if (opts.autostash) ignored.push("--autostash");
    if (opts.allowDirty) ignored.push("--allow-dirty");
    if (ignored.length > 0) {
      logger.warn(
        `${ignored.join(", ")} ${ignored.length === 1 ? "has" : "have"} no effect without --apply; running in preview mode.`,
      );
    }
  }

  const token = process.env.BITBUCKET_TOKEN;
  if (!token && opts.apply && opts.pr) {
    logger.error("BITBUCKET_TOKEN env var is required when using --apply --pr.");
    process.exit(2);
  }

  const config = await loadConfig(opts.config);
  const client = opts.apply && opts.pr
    ? new BitbucketClient({ baseUrl: config.bitbucketBaseUrl, token: token ?? "" })
    : null;

  await syncAll(config, client, {
    apply: opts.apply,
    pr: opts.pr,
    force: opts.force,
    showOutput: opts.showOutput,
    allowDirty: opts.allowDirty,
    autostash: opts.autostash,
  });
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
