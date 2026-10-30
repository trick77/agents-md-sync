import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HEADER, compose, type ComposeResult } from "./compose.js";
import type { Config } from "./config.js";
import { scaffoldProject } from "./scaffold.js";
import { loadTemplate } from "./templateLoader.js";

export type RunStatus = "written" | "up-to-date" | "out-of-date";

export interface RunOptions {
  /** Compare the composed AGENTS.md with the one on disk and write nothing. */
  check: boolean;
}

// Beyond ~150-200 instructions, LLM instruction-following degrades noticeably.
const AGENTS_MD_WARN_BYTES = 12_288;

export async function run(cfg: Config, opts: RunOptions): Promise<RunStatus> {
  const template = await loadTemplate(cfg.templateDir, cfg.profile);
  let custom = await readCustomFragments(cfg.repoDir);

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
    if (opts.check) {
      throw new Error(".agents/PROJECT.md is missing. Run without --check to scaffold it.");
    }
    const path = await scaffoldProject(cfg.repoDir);
    console.log(`scaffolded ${path}`);
    custom = await readCustomFragments(cfg.repoDir);
    result = composeOnce();
  }

  warnUnreferenced(result, custom, cfg.skip);

  if (result.agentsMd.length > AGENTS_MD_WARN_BYTES) {
    const kb = (result.agentsMd.length / 1024).toFixed(1);
    console.error(
      `warning: composed AGENTS.md is ${kb} KB (threshold ${AGENTS_MD_WARN_BYTES / 1024} KB); long instruction files degrade agent behavior`,
    );
  }

  const outPath = resolve(cfg.repoDir, "AGENTS.md");

  if (opts.check) {
    const existing = await readFile(outPath, "utf8").catch(() => null);
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

export async function readCustomFragments(repoDir: string): Promise<Record<string, string>> {
  const dir = resolve(repoDir, ".agents");
  const out: Record<string, string> = {};
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return out;
  }
  for (const f of files) {
    if (!f.endsWith(".md")) continue;
    out[f.replace(/\.md$/, "")] = await readFile(resolve(dir, f), "utf8");
  }
  return out;
}
