import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSingleTargetConfig } from "../src/config.js";
import { syncAll } from "../src/sync.js";

const WRITE_ONLY_OPTS = {
  apply: false,
  writeOnly: true,
  pr: false,
  force: false,
  showOutput: false,
  allowDirty: false,
  autostash: false,
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function makeTemplateRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agents-md-wo-tpl-"));
  await mkdir(join(root, "profiles", "angular"), { recursive: true });
  await writeFile(
    join(root, "profiles", "angular", "AGENTS.md.tmpl"),
    "<!-- include: PROJECT.md -->\n\n<!-- include: CODING.md -->\n",
    "utf8",
  );
  await writeFile(join(root, "profiles", "angular", "CODING.md"), "## Coding (angular)", "utf8");
  return root;
}

describe("buildSingleTargetConfig", () => {
  it("builds a single-target config from flags, without bitbucketBaseUrl", () => {
    const cfg = buildSingleTargetConfig({
      repo: "/tmp/repo",
      templateDir: "/tmp/tpl",
      profile: "angular",
      skip: ["BUILD"],
    });
    expect(cfg.targets).toHaveLength(1);
    expect(cfg.targets[0]?.dir).toBe("/tmp/repo");
    expect(cfg.targets[0]?.profile).toBe("angular");
    expect(cfg.targets[0]?.skip).toEqual(["BUILD"]);
    expect(cfg.bitbucketBaseUrl).toBeUndefined();
    expect(cfg.prBranch).toBe("feature/update-agents-md");
  });

  it("defaults repo to '.' when omitted", () => {
    const cfg = buildSingleTargetConfig({ templateDir: "/tmp/tpl", profile: "angular" });
    expect(cfg.targets[0]?.dir).toBe(".");
  });
});

describe("syncAll --write-only", () => {
  it("writes AGENTS.md into a non-git target and performs no git operations", async () => {
    const templateDir = await makeTemplateRepo();
    const targetDir = await mkdtemp(join(tmpdir(), "agents-md-wo-target-"));

    const config = buildSingleTargetConfig({ repo: targetDir, templateDir, profile: "angular" });
    await syncAll(config, null, WRITE_ONLY_OPTS);

    const agentsMd = await readFile(join(targetDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("## Coding (angular)");
    // no git repo was created or touched
    expect(await exists(join(targetDir, ".git"))).toBe(false);
  });

  it("scaffolds a missing PROJECT partial so the run does not fail", async () => {
    const templateDir = await makeTemplateRepo();
    const targetDir = await mkdtemp(join(tmpdir(), "agents-md-wo-target-"));

    const config = buildSingleTargetConfig({ repo: targetDir, templateDir, profile: "angular" });
    await syncAll(config, null, WRITE_ONLY_OPTS);

    expect(await exists(join(targetDir, ".agents", "PROJECT.md"))).toBe(true);
    const agentsMd = await readFile(join(targetDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("## Project");
  });
});
