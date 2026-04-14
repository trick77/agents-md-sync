import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listProfiles, renderProfile } from "./render-samples.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");
const EXAMPLES = resolve(ROOT, "examples");

async function main(): Promise<void> {
  const profiles = await listProfiles();
  const drifted: string[] = [];

  for (const profile of profiles) {
    const rendered = await renderProfile(profile);
    const path = resolve(EXAMPLES, `sample-output-${profile}.md`);
    let committed: string;
    try {
      committed = await readFile(path, "utf8");
    } catch {
      drifted.push(`${profile} (missing ${path})`);
      continue;
    }
    if (rendered !== committed) drifted.push(profile);
  }

  if (drifted.length > 0) {
    process.stderr.write(
      `Sample drift detected for: ${drifted.join(", ")}\n` +
        `Run \`npm run render:samples\` and commit the updated files.\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`all ${profiles.length} samples are up to date\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
