import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pc from "picocolors";
import type { BitbucketClient } from "./bitbucket.js";
import { buildHeader, compose } from "./compose.js";
import type { Config, Target } from "./config.js";
import { buildCommitMessage, buildPrDescription } from "./drift.js";
import {
  assertCleanWorkingTree,
  assertIsGitRepo,
  commitSyncChanges,
  detectDefaultBranch,
  getHeadRef,
  gitIn,
  hasStagedChanges,
  prepareTargetRepo,
  pushBranch,
  remoteToProjectRepo,
  stashPop,
  stashPush,
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
  showOutput: boolean;
  allowDirty: boolean;
  autostash: boolean;
}

export async function syncAll(
  config: Config,
  client: BitbucketClient | null,
  opts: SyncOptions,
): Promise<void> {
  const templateDirAbs = resolve(config.localGitBaseDir, config.templateDir);
  const templateLabel = config.templateDir;

  for (const target of config.targets) {
    try {
      await syncTarget(config, target, client, opts, {
        templateDirAbs,
        templateLabel,
      });
    } catch (err) {
      logger.error(`sync failed for ${target.dir}:`, err);
    }
  }

  if (!opts.apply) {
    logger.info("");
    logger.info(pc.dim("Preview only — no files changed, no commits, no push."));
    logger.info(
      pc.dim("Run with ") +
        pc.cyan("--apply") +
        pc.dim(" to sync, or ") +
        pc.cyan("--show-output") +
        pc.dim(" to see the full composed AGENTS.md."),
    );
    logger.info(pc.dim("See ") + pc.cyan("--help") + pc.dim(" for all options."));
  }
}

interface TemplateCtx {
  templateDirAbs: string;
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
  logger.info(`${pc.blue("▶")} ${pc.bold(target.dir)} ${pc.dim(`(profile: ${target.profile})`)}`);

  const targetGit = gitIn(targetDir);
  await assertIsGitRepo(targetGit, targetDir);
  if (!opts.allowDirty && !opts.autostash) {
    await assertCleanWorkingTree(targetGit);
  }

  const defaultBranch = await detectDefaultBranch(targetGit);
  const prBranch = config.prBranch;

  const template = await loadTemplate(ctx.templateDirAbs, target.profile);
  const customPartials = await readCustomPartials(targetDir);

  const header = buildHeader(ctx.templateLabel);
  let result = compose({
    skeleton: template.skeleton,
    centralPartials: template.partials,
    customPartials,
    skip: target.skip,
    header,
  });

  const SCAFFOLD_PARTIALS = new Set(["PROJECT"]);
  let scaffoldCandidates: string[] = [];

  if (result.missing.length > 0) {
    const toScaffold = result.missing.filter((n) => SCAFFOLD_PARTIALS.has(n));
    const unresolved = result.missing.filter((n) => !SCAFFOLD_PARTIALS.has(n));

    if (unresolved.length > 0) {
      throw new Error(
        `Skeleton references partials not found in central templates or .agents/: ${unresolved.join(", ")}`,
      );
    }

    if (toScaffold.length > 0) {
      if (opts.apply) {
        await scaffoldMissingPartials(targetDir, toScaffold);
        const refreshedPartials = await readCustomPartials(targetDir);
        result = compose({
          skeleton: template.skeleton,
          centralPartials: template.partials,
          customPartials: refreshedPartials,
          skip: target.skip,
          header,
        });
      } else {
        scaffoldCandidates = toScaffold;
      }
    }
  }

  const AGENTS_MD_WARN_BYTES = 12_288; // 12 KB
  if (result.agentsMd.length > AGENTS_MD_WARN_BYTES) {
    const kb = (result.agentsMd.length / 1024).toFixed(1);
    logger.warn(
      `    composed AGENTS.md is ${kb} KB (threshold: ${AGENTS_MD_WARN_BYTES / 1024} KB) — beyond ~150-200 instructions, LLM instruction-following degrades noticeably`,
    );
  }

  const plannedWrites = buildPlannedWrites(result.agentsMd);

  if (!opts.apply) {
    for (const line of renderPreviewLines(result, ctx.templateLabel, target.profile, scaffoldCandidates)) {
      logger.info(line);
    }
    if (opts.showOutput) {
      logger.info(`    ${pc.dim("--- composed AGENTS.md ---")}\n${result.agentsMd}`);
    }
    return;
  }

  if (opts.pr && !client) {
    throw new Error("BitbucketClient is required for --apply --pr runs");
  }

  if (opts.force && !opts.pr) {
    logger.warn("    --force has no effect without --pr (PR step is skipped)");
  }

  if (!opts.pr) {
    logger.info(`    ${pc.dim("PR step skipped (pass --pr to open a pull request)")}`);
  }

  let originalRef: string | null = null;
  let stashed = false;
  if (opts.autostash) {
    originalRef = await getHeadRef(targetGit);
    stashed = await stashPush(targetGit, `agents-md-sync autostash ${new Date().toISOString()}`);
    if (stashed) logger.info(`    ${pc.dim("autostash:")} saved local changes ${pc.dim(`(was on ${originalRef})`)}`);
  }

  try {
    await prepareTargetRepo(targetGit, defaultBranch, prBranch);

    for (const [path, content] of Object.entries(plannedWrites)) {
      const full = resolve(targetDir, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content, "utf8");
    }

    if (!(await hasStagedChanges(targetGit)) && !opts.force) {
      logger.info(`    ${pc.green("✓")} up to date`);
      return;
    }

    const commitMessage = buildCommitMessage(ctx.templateLabel);
    await commitSyncChanges(targetGit, Object.keys(plannedWrites), commitMessage);
    await pushBranch(targetGit, prBranch);
    logger.info(`    ${pc.green("✓")} pushed ${pc.bold(prBranch)}`);

    if (opts.pr && client) {
      const prClient = client;
      const remote = await targetGit.raw(["remote", "get-url", "origin"]);
      const ref = remoteToProjectRepo(remote);

      const description = buildPrDescription({
        templateRepoLabel: ctx.templateLabel,
        included: result.included,
        skipped: result.skipped,
        withCustom: result.withCustom,
      });

      const existing = await prClient.findOpenPullRequest(ref, prBranch, defaultBranch);
      if (existing) {
        await prClient.updatePullRequestDescription(ref, existing.id, PR_TITLE, description);
        logger.info(`    ${pc.green("✓")} PR ${pc.bold(`#${existing.id}`)} updated ${pc.cyan(existing.url)}`);
      } else {
        const pr = await prClient.createPullRequest(ref, prBranch, defaultBranch, PR_TITLE, description);
        logger.info(`    ${pc.green("✓")} PR ${pc.bold(`#${pr.id}`)} ${pc.cyan(pr.url)}`);
      }
    }
  } finally {
    if (opts.autostash && originalRef) {
      try {
        await targetGit.checkout(originalRef);
      } catch (err) {
        logger.error(`    autostash: could not restore ${originalRef}:`, err);
      }
      if (stashed) {
        try {
          await stashPop(targetGit);
          logger.info(`    ${pc.dim("autostash:")} restored local changes`);
        } catch (err) {
          logger.error(
            `    autostash: pop failed — your changes are preserved in 'git stash list' in ${targetDir}:`,
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

export function renderPreviewLines(
  result: {
    agentsMd: string;
    order: Array<{
      name: string;
      status: "included" | "skipped" | "missing";
      source?: "central" | "custom" | "both";
      centralBytes?: number;
      customBytes?: number;
    }>;
    included: string[];
    skipped: string[];
    withCustom: string[];
  },
  templateLabel: string,
  profile: string,
  scaffoldCandidates: string[] = [],
): string[] {
  const lines: string[] = [];
  const scaffoldSet = new Set(scaffoldCandidates);
  lines.push(`    ${pc.dim("template:")} ${templateLabel} ${pc.dim(`(profile: ${profile})`)}`);
  lines.push(`    ${pc.dim(`partials (${result.order.length} total):`)}`);

  const nameWidth = Math.max(0, ...result.order.map((e) => e.name.length));

  for (const entry of result.order) {
    const padded = entry.name.padEnd(nameWidth);
    if (entry.status === "skipped") {
      lines.push(`      ${pc.yellow("✗")} ${padded}  ${pc.yellow("skipped")} ${pc.dim("(listed in target.skip)")}`);
      continue;
    }
    if (entry.status === "missing") {
      if (scaffoldSet.has(entry.name)) {
        lines.push(
          `      ${pc.cyan("+")} ${padded}  ${pc.cyan("will be scaffolded")} ${pc.dim(`at .agents/${entry.name}.md on --apply`)}`,
        );
      } else {
        lines.push(
          `      ${pc.red("!")} ${padded}  ${pc.red("MISSING")} ${pc.dim("— no central and no .agents/ override")}`,
        );
      }
      continue;
    }
    const central = entry.centralBytes ?? 0;
    const custom = entry.customBytes ?? 0;
    const detail =
      entry.source === "both"
        ? `${pc.magenta("central+local")} ${pc.dim(`(${fmtBytes(central)} + ${fmtBytes(custom)} addendum from .agents/${entry.name}.md)`)}`
        : entry.source === "custom"
          ? `${pc.magenta("local only")} ${pc.dim(`(${fmtBytes(custom)}; .agents/${entry.name}.md — no central partial)`)}`
          : `${pc.magenta("central only")} ${pc.dim(`(${fmtBytes(central)})`)}`;
    lines.push(`      ${pc.green("✓")} ${padded}  ${detail}`);
  }

  const kb = (result.agentsMd.length / 1024).toFixed(1);
  const parts = [
    `included ${result.included.length}`,
    `skipped ${result.skipped.length}`,
    `addenda on ${result.withCustom.length}`,
  ];
  if (scaffoldCandidates.length > 0) parts.push(`to scaffold ${scaffoldCandidates.length}`);
  lines.push(
    `    ${pc.dim("composed AGENTS.md:")} ${pc.bold(`${kb} KB`)} ${pc.dim(`(${parts.join(", ")})`)}`,
  );
  lines.push(`    ${pc.green("[preview]")} would write ${pc.bold("AGENTS.md")} ${pc.dim("(pass --apply to actually write)")}`);
  return lines;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
