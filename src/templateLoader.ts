import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

export interface ResolvedTemplate {
  skeleton: string;
  partials: Record<string, string>;
  centralSha: string;
}

export async function loadTemplate(
  rootDir: string,
  profile: string,
  centralSha: string,
): Promise<ResolvedTemplate> {
  const skeletonPath = resolve(rootDir, "profiles", profile, "AGENTS.md.tmpl");
  const skeleton = await readFile(skeletonPath, "utf8");

  const common = await loadMarkdownDir(resolve(rootDir, "common"));
  const profilePartials = await loadMarkdownDir(resolve(rootDir, "profiles", profile, "partials"));
  const partials = { ...common, ...profilePartials };

  return { skeleton, partials, centralSha };
}

async function loadMarkdownDir(dir: string): Promise<Record<string, string>> {
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
