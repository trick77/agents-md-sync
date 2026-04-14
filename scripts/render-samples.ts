import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHeader, compose } from "../src/compose.js";
import { loadTemplate } from "../src/templateLoader.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");
const EXAMPLES = resolve(ROOT, "examples");
const TEMPLATES = resolve(EXAMPLES, "template-repo");
const TEMPLATE_LABEL = "TOOLING/agents-md-templates";
const FAKE_SHA = "<sha>";

export async function renderProfile(profile: string): Promise<string> {
  const template = await loadTemplate(TEMPLATES, profile, FAKE_SHA);
  const result = compose({
    skeleton: template.skeleton,
    centralPartials: template.partials,
    customPartials: {},
    skip: [],
    header: buildHeader(TEMPLATE_LABEL, FAKE_SHA),
  });

  if (result.missing.length > 0) {
    throw new Error(`Profile '${profile}' references missing partials: ${result.missing.join(", ")}`);
  }
  return result.agentsMd;
}

export async function listProfiles(): Promise<string[]> {
  const entries = await readdir(resolve(TEMPLATES, "profiles"), { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

async function main(): Promise<void> {
  const profiles = await listProfiles();
  for (const profile of profiles) {
    const rendered = await renderProfile(profile);
    const outPath = resolve(EXAMPLES, `sample-output-${profile}.md`);
    await writeFile(outPath, rendered, "utf8");
    process.stdout.write(`rendered ${outPath}\n`);
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
