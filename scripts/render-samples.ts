import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HEADER, compose } from "../src/compose.js";
import { loadMarkdownDir, loadTemplate } from "../src/templateLoader.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");
const EXAMPLES = resolve(ROOT, "examples");
const TEMPLATES = resolve(EXAMPLES, "template-repo");
const SAMPLE_TARGETS = resolve(EXAMPLES, "sample-targets");

// sample-targets/<profile>/ stands in for a target repo's .agents/ directory
async function loadSampleTargetFragments(profile: string): Promise<Record<string, string>> {
  const fragments = await loadMarkdownDir(resolve(SAMPLE_TARGETS, profile));
  if (fragments.PROJECT === undefined) {
    throw new Error(
      `Profile '${profile}' needs examples/sample-targets/${profile}/PROJECT.md to render its sample output`,
    );
  }
  return fragments;
}

export async function renderProfile(profile: string): Promise<string> {
  const template = await loadTemplate(TEMPLATES, profile);
  const result = compose({
    skeleton: template.skeleton,
    centralFragments: template.fragments,
    customFragments: await loadSampleTargetFragments(profile),
    skip: [],
    header: HEADER,
  });

  if (result.missing.length > 0) {
    throw new Error(`Profile '${profile}' references missing fragments: ${result.missing.join(", ")}`);
  }
  return result.agentsMd;
}

export async function listProfiles(): Promise<string[]> {
  const entries = await readdir(resolve(TEMPLATES, "profiles"), { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function main(): Promise<void> {
  for (const profile of await listProfiles()) {
    const outPath = resolve(EXAMPLES, `sample-output-${profile}.md`);
    await writeFile(outPath, await renderProfile(profile), "utf8");
    process.stdout.write(`rendered ${outPath}\n`);
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
