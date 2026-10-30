import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HEADER, byteLen, compose, type ComposeResult } from "./compose.js";
import type { Config } from "./config.js";
import { scaffoldProject } from "./scaffold.js";
import { loadMarkdownDir, loadTemplate } from "./templateLoader.js";

export type RunStatus = "written" | "up-to-date" | "out-of-date";

export interface RunOptions {
  /** Compare the composed AGENTS.md with the one on disk and write nothing. */
  check: boolean;
}

// Beyond ~150-200 instructions, LLM instruction-following degrades noticeably.
const AGENTS_MD_WARN_BYTES = 12_288;

export async function run(cfg: Config, opts: RunOptions): Promise<RunStatus> {
  await assertDirectory(cfg.repoDir, "--repo");

  const template = await loadTemplate(cfg.templateDir, cfg.profile);
  const agentsDir = resolve(cfg.repoDir, ".agents");
  let custom = await loadMarkdownDir(agentsDir);

  const composeOnce = (): ComposeResult =>
    compose({
      skeleton: template.skeleton,
      centralFragments: template.fragments,
      customFragments: custom,
      skip: cfg.skip,
      header: HEADER,
    });

  let result = composeOnce();

  if (result.missing.length > 0) {
    const unresolved = result.missing.filter((n) => n !== "PROJECT");
    if (unresolved.length > 0) {
      throw new Error(
        `Skeleton references fragments not found in central templates or .agents/: ${unresolved.join(", ")}`,
      );
    }
    // compose() treats a blank fragment as absent; never overwrite a file the repo owns.
    if (custom.PROJECT !== undefined) {
      throw new Error(".agents/PROJECT.md is empty. Describe the project in it.");
    }
    if (opts.check) {
      throw new Error(".agents/PROJECT.md is missing. Run without --check to scaffold it.");
    }
    const path = await scaffoldProject(cfg.repoDir);
    console.log(`scaffolded ${path}`);
    custom = await loadMarkdownDir(agentsDir);
    result = composeOnce();
  }

  warnUnreferenced(result, custom, cfg.skip);

  const bytes = byteLen(result.agentsMd);
  if (bytes > AGENTS_MD_WARN_BYTES) {
    console.error(
      `warning: composed AGENTS.md is ${(bytes / 1024).toFixed(1)} KB (threshold ${AGENTS_MD_WARN_BYTES / 1024} KB); long instruction files degrade agent behavior`,
    );
  }

  const outPath = resolve(cfg.repoDir, "AGENTS.md");

  if (opts.check) {
    const existing = await readIfExists(outPath);
    if (existing === result.agentsMd) {
      console.log("AGENTS.md is up to date");
      return "up-to-date";
    }
    console.error(
      existing === null
        ? "AGENTS.md is missing. Run without --check to generate it."
        : "AGENTS.md is out of date. Run without --check to regenerate it.",
    );
    return "out-of-date";
  }

  await writeFile(outPath, result.agentsMd, "utf8");
  console.log(
    `wrote ${outPath} (profile ${cfg.profile}; ${result.included.length} fragments, ${result.withCustom.length} with .agents/ addenda)`,
  );
  return "written";
}

async function assertDirectory(path: string, flag: string): Promise<void> {
  const s = await stat(path).catch(() => null);
  if (!s?.isDirectory()) throw new Error(`${flag}: not a directory: ${path}`);
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function warnUnreferenced(result: ComposeResult, custom: Record<string, string>, skip: string[]): void {
  const referenced = new Set(result.order.map((e) => e.name));
  for (const name of Object.keys(custom)) {
    if (!referenced.has(name)) {
      console.error(`warning: .agents/${name}.md matches no include in the skeleton and is ignored`);
    }
  }
  for (const name of skip) {
    if (!referenced.has(name)) {
      console.error(`warning: --skip ${name} matches no include in the skeleton`);
    }
  }
}
