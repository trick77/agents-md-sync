import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigSchema, loadConfig } from "../src/config.js";

async function tempFile(contents: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agents-md-config-"));
  const path = join(dir, "targets.json");
  await writeFile(path, contents, "utf8");
  return path;
}

describe("ConfigSchema", () => {
  const base = {
    localGitBaseDir: "/tmp/base",
    templateDir: "/tmp/tpl",
    bitbucketBaseUrl: "https://bitbucket.example.com",
    targets: [{ dir: "repo", profile: "angular" }],
  };

  it("applies defaults for prBranch and target.skip", () => {
    const parsed = ConfigSchema.parse(base);
    expect(parsed.prBranch).toBe("feature/update-agents-md");
    expect(parsed.targets[0]?.skip).toEqual([]);
  });

  it("rejects non-URL bitbucketBaseUrl", () => {
    expect(() => ConfigSchema.parse({ ...base, bitbucketBaseUrl: "not-a-url" })).toThrow();
  });

  it("rejects empty targets array", () => {
    expect(() => ConfigSchema.parse({ ...base, targets: [] })).toThrow();
  });

  it("rejects target missing required fields", () => {
    expect(() => ConfigSchema.parse({ ...base, targets: [{ dir: "" }] })).toThrow();
  });
});

describe("loadConfig", () => {
  it("reads and parses a valid JSON config file", async () => {
    const path = await tempFile(
      JSON.stringify({
        localGitBaseDir: "/tmp/base",
        templateDir: "/tmp/tpl",
        bitbucketBaseUrl: "https://bitbucket.example.com",
        targets: [{ dir: "repo", profile: "angular", skip: ["BUILD"] }],
      }),
    );
    const cfg = await loadConfig(path);
    expect(cfg.targets[0]?.skip).toEqual(["BUILD"]);
    expect(cfg.prBranch).toBe("feature/update-agents-md");
  });

  it("throws on malformed JSON", async () => {
    const path = await tempFile("{ not json");
    await expect(loadConfig(path)).rejects.toThrow();
  });
});
