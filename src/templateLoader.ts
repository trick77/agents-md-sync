import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

export interface ResolvedTemplate {
  skeleton: string;
  fragments: Record<string, string>;
}

export const DEFAULT_SKELETON = `<!-- include: PROJECT.md -->

<!-- include: CODING.md -->

<!-- include: TESTING.md -->

<!-- include: BUILD.md -->

<!-- include: REVIEW.md -->

<!-- include: DO_NOT.md -->
`;

export async function loadTemplate(
  rootDir: string,
  profile: string,
): Promise<ResolvedTemplate> {
  const profileDir = resolve(rootDir, "profiles", profile);
  try {
    const s = await stat(profileDir);
    if (!s.isDirectory()) throw new Error(`not a directory: ${profileDir}`);
  } catch {
    throw new Error(`Unknown profile "${profile}": ${profileDir} does not exist`);
  }

  const skeletonPath = resolve(profileDir, "AGENTS.md.tmpl");
  let skeleton: string;
  try {
    skeleton = await readFile(skeletonPath, "utf8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      skeleton = DEFAULT_SKELETON;
    } else {
      throw err;
    }
  }

  const common = await loadMarkdownDir(resolve(rootDir, "common"));
  // Profile fragments live alongside AGENTS.md.tmpl; only *.md files are picked up,
  // so the .tmpl skeleton is naturally excluded. Any stray .md here becomes a fragment.
  const profileFragments = await loadMarkdownDir(profileDir);
  const fragments = { ...common, ...profileFragments };

  return { skeleton, fragments };
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
