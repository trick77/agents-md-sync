#!/usr/bin/env node
import { Command } from "commander";
import { BitbucketClient } from "./bitbucket.js";
import { loadConfig } from "./config.js";
import { logger, setLevel } from "./logger.js";
import { syncAll } from "./sync.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("agents-md-sync")
    .description("Generate and sync AGENTS.md across locally-cloned Bitbucket repos.")
    .requiredOption("-c, --config <path>", "path to targets.json")
    .option("--apply", "actually commit and push. Default is preview only.", false)
    .option("--pr", "open or update a pull request after pushing (requires --apply)", false)
    .option("--force", "open a PR even when nothing changed (requires --apply --pr)", false)
    .option("--allow-dirty", "skip the clean-working-tree check on target repos (destructive: uncommitted changes are discarded by the default-branch reset)", false)
    .option("--autostash", "stash local changes before sync and pop them after (safe alternative to --allow-dirty)", false)
    .option("-v, --verbose", "enable debug logging", false);

  program.parse(process.argv);
  const opts = program.opts<{
    config: string;
    apply: boolean;
    pr: boolean;
    force: boolean;
    allowDirty: boolean;
    autostash: boolean;
    verbose: boolean;
  }>();

  if (opts.verbose) setLevel("debug");

  if (opts.pr && !opts.apply) {
    logger.warn("--pr has no effect without --apply; running in preview mode.");
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
    allowDirty: opts.allowDirty,
    autostash: opts.autostash,
  });
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
