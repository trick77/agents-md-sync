import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { BitbucketClient } from "./bitbucket.js";
import { buildHeader, compose } from "./compose.js";
import type { Config, Target } from "./config.js";
import { buildCommitMessage, buildPrDescription } from "./drift.js";
import {
  assertCleanWorkingTree,
  commitSyncChanges,
  detectDefaultBranch,
  getHeadRef,
  gitIn,
  hasStagedChanges,
  prepareTargetRepo,
  pushBranch,
  readLastSyncSha,
  remoteToProjectRepo,
  stashPop,
  stashPush,
  templateCommitsSince,
  templateHeadSha,
} from "./git.js";
import { logger } from "./logger.js";
import { loadTemplate } from "./templateLoader.js";
import { scaffoldMissingPartials } from "./scaffold.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const PR_TITLE = "chore: update AGENTS.md";

export interface SyncOptions {
  apply: boolean;
  pr: boolean;
  force: boolean;
  allowDirty: boolean;
  autostash: boolean;
}

export async function syncAll(
  config: Config,
  client: BitbucketClient | null,
  opts: SyncOptions,
): Promise<void> {
  const templateDirAbs = resolve(config.localGitBaseDir, config.templateDir);
  const templateGit = gitIn(templateDirAbs);
  const templateSha = await templateHeadSha(templateGit);
  const templateLabel = config.templateDir;

  for (const target of config.targets) {
    try {
      await syncTarget(config, target, client, opts, {
        templateDirAbs,
        templateSha,
        templateLabel,
      });
    } catch (err) {
      logger.error(`sync failed for ${target.dir}:`, err);
    }
  }
}

interface TemplateCtx {
  templateDirAbs: string;
  templateSha: string;
  templateLabel: string;
}

async function syncTarget(
  config: Config,
  target: Target,
  client: BitbucketClient | null,
  opts: SyncOptions,
  ctx: TemplateCtx,
): Promise<void> {
  const targetDir = resolve(config.localGitBaseDir, target.dir);
  logger.info(`▶ ${target.dir} (profile: ${target.profile})`);

  const targetGit = gitIn(targetDir);
  if (!opts.allowDirty && !opts.autostash) {
    await assertCleanWorkingTree(targetGit);
  }

  const defaultBranch = await detectDefaultBranch(targetGit);
  const prBranch = config.prBranch;

  const template = await loadTemplate(ctx.templateDirAbs, target.profile, ctx.templateSha);
  const customPartials = await readCustomPartials(targetDir);

  const header = buildHeader(ctx.templateLabel, ctx.templateSha);
  let result = compose({
    skeleton: template.skeleton,
    centralPartials: template.partials,
    customPartials,
    skip: target.skip,
    header,
  });

  if (result.missing.length > 0) {
    await scaffoldMissingPartials(targetDir, result.missing);
    const refreshedPartials = await readCustomPartials(targetDir);
    result = compose({
      skeleton: template.skeleton,
      centralPartials: template.partials,
      customPartials: refreshedPartials,
      skip: target.skip,
      header,
    });
    if (result.missing.length > 0) {
      throw new Error(`Skeleton references missing partials after scaffold: ${result.missing.join(", ")}`);
    }
  }

  const plannedWrites = buildPlannedWrites(result.agentsMd);

  if (!opts.apply) {
    logger.info(`  [preview] ${Object.keys(plannedWrites).length} file(s) would be considered for write`);
    logger.info(`  --- composed AGENTS.md ---\n${result.agentsMd}`);
    return;
  }

  if (opts.pr && !client) {
    throw new Error("BitbucketClient is required for --apply --pr runs");
  }

  if (opts.force && !opts.pr) {
    logger.warn("  --force has no effect without --pr (PR step is skipped)");
  }

  if (!opts.pr) {
    logger.info("  PR step skipped (pass --pr to open a pull request)");
  }

  let originalRef: string | null = null;
  let stashed = false;
  if (opts.autostash) {
    originalRef = await getHeadRef(targetGit);
    stashed = await stashPush(targetGit, `agents-md-sync autostash ${new Date().toISOString()}`);
    if (stashed) logger.info(`  autostash: saved local changes (was on ${originalRef})`);
  }

  try {
    await prepareTargetRepo(targetGit, defaultBranch, prBranch);

    for (const [path, content] of Object.entries(plannedWrites)) {
      const full = resolve(targetDir, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content, "utf8");
    }

    if (!(await hasStagedChanges(targetGit)) && !opts.force) {
      logger.info(`  up to date`);
      return;
    }

    const lastSync = await readLastSyncSha(targetGit, defaultBranch);
    const lastSyncSha = lastSync?.sha ?? null;

    const templateGit = gitIn(ctx.templateDirAbs);
    const upstreamCommits = lastSyncSha
      ? await templateCommitsSince(templateGit, lastSyncSha, target.profile)
      : [];

    const commitMessage = buildCommitMessage(ctx.templateLabel, ctx.templateSha);
    await commitSyncChanges(targetGit, Object.keys(plannedWrites), commitMessage);
    await pushBranch(targetGit, prBranch);
    logger.info(`  pushed ${prBranch}`);

    if (opts.pr && client) {
      const prClient = client;
      const remote = await targetGit.raw(["remote", "get-url", "origin"]);
      const ref = remoteToProjectRepo(remote);

      const description = buildPrDescription({
        templateRepoLabel: ctx.templateLabel,
        centralSha: ctx.templateSha,
        lastSyncSha,
        upstreamCommitsSinceLastSync: upstreamCommits,
        included: result.included,
        skipped: result.skipped,
        withCustom: result.withCustom,
      });

      const existing = await prClient.findOpenPullRequest(ref, prBranch, defaultBranch);
      if (existing) {
        await prClient.updatePullRequestDescription(ref, existing.id, PR_TITLE, description);
        logger.info(`  PR #${existing.id} updated ${existing.url}`);
      } else {
        const pr = await prClient.createPullRequest(ref, prBranch, defaultBranch, PR_TITLE, description);
        logger.info(`  PR #${pr.id} ${pr.url}`);
      }
    }
  } finally {
    if (opts.autostash && originalRef) {
      try {
        await targetGit.checkout(originalRef);
      } catch (err) {
        logger.error(`  autostash: could not restore ${originalRef}:`, err);
      }
      if (stashed) {
        try {
          await stashPop(targetGit);
          logger.info(`  autostash: restored local changes`);
        } catch (err) {
          logger.error(
            `  autostash: pop failed — your changes are preserved in 'git stash list' in ${targetDir}:`,
            err,
          );
        }
      }
    }
  }
}

async function readCustomPartials(targetDir: string): Promise<Record<string, string>> {
  const dir = resolve(targetDir, ".agents");
  const out: Record<string, string> = {};
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return out;
  }
  for (const f of files) {
    if (!f.endsWith(".md")) continue;
    const name = f.replace(/\.md$/, "");
    out[name] = await readFile(resolve(dir, f), "utf8");
  }
  return out;
}

function buildPlannedWrites(agentsMd: string): Record<string, string> {
  return { "AGENTS.md": agentsMd };
}
