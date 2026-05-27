#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { BitbucketClient } from "./bitbucket.js";
import { buildSingleTargetConfig, loadConfig, type Config } from "./config.js";
import { logger, setLevel } from "./logger.js";
import { syncAll } from "./sync.js";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

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
      "  # Config-less single-repo mode: write AGENTS.md into the current repo,",
      "  # performing no git operations (commit/push is left to the caller).",
      "  agents-md-sync --write-only --repo . --template-dir ../agents-md-templates --profile spring-boot-maven",
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
    .option("--repo <dir>", "config-less single-repo mode: target repo dir (default: current dir). Use with --template-dir and --profile instead of --config.")
    .option("--template-dir <path>", "config-less single-repo mode: central template directory")
    .option("--profile <name>", "config-less single-repo mode: profile to use")
    .option("--skip <name>", "config-less single-repo mode: partial to skip (repeatable)", collect, [])
    .option("--bitbucket-base-url <url>", "config-less single-repo mode: Bitbucket base URL (only needed with --apply --pr)")
    .option("--apply", "actually commit and push. Default is preview only.", false)
    .option("--write-only", "write AGENTS.md into the target working tree and perform no git operations (no commit/push). Mutually exclusive with --apply.", false)
    .option("--pr", "open or update a pull request after pushing (requires --apply)", false)
    .option("--force", "open a PR even when nothing changed (requires --apply --pr)", false)
    .option("--show-output", "in preview mode, also print the full composed AGENTS.md for each target", false)
    .option("--allow-dirty", "skip the clean-working-tree check on target repos (destructive: uncommitted changes are discarded by the default-branch reset)", false)
    .option("--autostash", "stash local changes before sync and pop them after (safe alternative to --allow-dirty)", false)
    .option("-v, --verbose", "enable debug logging", false);

  program.parse(process.argv);
  const opts = program.opts<{
    config?: string;
    repo?: string;
    templateDir?: string;
    profile?: string;
    skip: string[];
    bitbucketBaseUrl?: string;
    apply: boolean;
    writeOnly: boolean;
    pr: boolean;
    force: boolean;
    showOutput: boolean;
    allowDirty: boolean;
    autostash: boolean;
    verbose: boolean;
  }>();

  if (opts.verbose) setLevel("debug");

  if (opts.apply && opts.writeOnly) {
    logger.error("--write-only and --apply are mutually exclusive.");
    process.exit(2);
  }

  const singleRepoFlagsPresent = Boolean(
    opts.repo !== undefined || opts.templateDir || opts.profile || opts.skip.length > 0,
  );

  if (opts.config && singleRepoFlagsPresent) {
    logger.error(
      "--config and the single-repo flags (--repo/--template-dir/--profile/--skip) are mutually exclusive.",
    );
    process.exit(2);
  }

  if (!opts.apply) {
    const ignored: string[] = [];
    if (opts.pr) ignored.push("--pr");
    if (opts.force) ignored.push("--force");
    if (opts.autostash) ignored.push("--autostash");
    if (opts.allowDirty) ignored.push("--allow-dirty");
    if (ignored.length > 0) {
      const suffix = opts.writeOnly ? "with --write-only" : "without --apply; running in preview mode";
      logger.warn(
        `${ignored.join(", ")} ${ignored.length === 1 ? "has" : "have"} no effect ${suffix}.`,
      );
    }
  }

  let config: Config;
  if (opts.config) {
    config = await loadConfig(opts.config);
  } else if (singleRepoFlagsPresent) {
    if (!opts.templateDir || !opts.profile) {
      logger.error("config-less single-repo mode requires both --template-dir and --profile.");
      process.exit(2);
    }
    config = buildSingleTargetConfig({
      repo: opts.repo,
      templateDir: opts.templateDir,
      profile: opts.profile,
      skip: opts.skip,
      bitbucketBaseUrl: opts.bitbucketBaseUrl,
    });
  } else {
    printUsage(program);
    return;
  }

  const token = process.env.BITBUCKET_TOKEN;
  if (!token && opts.apply && opts.pr) {
    logger.error("BITBUCKET_TOKEN env var is required when using --apply --pr.");
    process.exit(2);
  }

  if (opts.apply && opts.pr && !config.bitbucketBaseUrl) {
    logger.error("bitbucketBaseUrl is required when using --apply --pr (set it in the config or via --bitbucket-base-url).");
    process.exit(2);
  }

  const client = opts.apply && opts.pr
    ? new BitbucketClient({ baseUrl: config.bitbucketBaseUrl ?? "", token: token ?? "" })
    : null;

  await syncAll(config, client, {
    apply: opts.apply,
    writeOnly: opts.writeOnly,
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
