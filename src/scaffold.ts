import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const PROJECT_TEMPLATE = `## Project {{projectName}}

<!-- Describe your project here: what it does, its domain, who uses it, key
     performance constraints, and anything else an AI agent should know before
     touching the code. -->
`;

/** Write a placeholder `.agents/PROJECT.md`. The only file the tool ever creates under `.agents/`. */
export async function scaffoldProject(repoDir: string): Promise<string> {
  const agentsDir = resolve(repoDir, ".agents");
  await mkdir(agentsDir, { recursive: true });
  const projectName = basename(resolve(repoDir));
  const filePath = resolve(agentsDir, "PROJECT.md");
  await writeFile(filePath, PROJECT_TEMPLATE.replace("{{projectName}}", projectName), "utf8");
  return filePath;
}
