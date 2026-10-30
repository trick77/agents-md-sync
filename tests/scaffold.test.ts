import { readFile, rm, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaffoldProject } from "../src/scaffold.js";

describe("scaffoldProject", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `agents-md-sync-test-${randomBytes(6).toString("hex")}`);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .agents/ even when the repo dir does not exist yet", async () => {
    await scaffoldProject(tmpDir);
    expect((await stat(join(tmpDir, ".agents"))).isDirectory()).toBe(true);
  });

  it("writes PROJECT.md titled with the repo directory name and returns its path", async () => {
    const path = await scaffoldProject(tmpDir);
    expect(path).toBe(join(tmpDir, ".agents", "PROJECT.md"));
    const content = await readFile(path, "utf8");
    expect(content).toMatch(new RegExp(`^## Project ${tmpDir.split("/").pop()!}`));
    expect(content).toContain("<!--");
  });
});
