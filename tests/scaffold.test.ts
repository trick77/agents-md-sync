import { readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaffoldMissingPartials } from "../src/scaffold.js";
import { rm } from "node:fs/promises";

describe("scaffoldMissingPartials", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `agents-md-sync-test-${randomBytes(6).toString("hex")}`);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .agents/ when it does not exist", async () => {
    await scaffoldMissingPartials(tmpDir, ["PROJECT"]);
    const s = await stat(join(tmpDir, ".agents"));
    expect(s.isDirectory()).toBe(true);
  });

  it("creates .agents/ when the target dir itself does not exist", async () => {
    await scaffoldMissingPartials(tmpDir, ["BUILD"]);
    const s = await stat(join(tmpDir, ".agents"));
    expect(s.isDirectory()).toBe(true);
  });

  it("writes PROJECT.md with a placeholder heading and comment", async () => {
    await scaffoldMissingPartials(tmpDir, ["PROJECT"]);
    const content = await readFile(join(tmpDir, ".agents", "PROJECT.md"), "utf8");
    expect(content).toMatch(/^## Project/);
    expect(content).toContain("<!--");
  });

  it("writes CODING.md with a placeholder heading and comment", async () => {
    await scaffoldMissingPartials(tmpDir, ["CODING"]);
    const content = await readFile(join(tmpDir, ".agents", "CODING.md"), "utf8");
    expect(content).toMatch(/^## Coding/);
    expect(content).toContain("<!--");
  });

  it("writes TESTING.md with a placeholder heading and comment", async () => {
    await scaffoldMissingPartials(tmpDir, ["TESTING"]);
    const content = await readFile(join(tmpDir, ".agents", "TESTING.md"), "utf8");
    expect(content).toMatch(/^## Testing/);
    expect(content).toContain("<!--");
  });

  it("writes BUILD.md with a placeholder heading and comment", async () => {
    await scaffoldMissingPartials(tmpDir, ["BUILD"]);
    const content = await readFile(join(tmpDir, ".agents", "BUILD.md"), "utf8");
    expect(content).toMatch(/^## Build/);
    expect(content).toContain("<!--");
  });

  it("writes REVIEW.md with example review guidelines", async () => {
    await scaffoldMissingPartials(tmpDir, ["REVIEW"]);
    const content = await readFile(join(tmpDir, ".agents", "REVIEW.md"), "utf8");
    expect(content).toMatch(/^## Review/);
    expect(content).toContain("One logical change per PR");
  });

  it("writes DO_NOT.md with example prohibitions", async () => {
    await scaffoldMissingPartials(tmpDir, ["DO_NOT"]);
    const content = await readFile(join(tmpDir, ".agents", "DO_NOT.md"), "utf8");
    expect(content).toMatch(/^## Do Not/);
    expect(content).toContain("Do not commit secrets");
  });

  it("writes a generic placeholder for unknown partial names", async () => {
    await scaffoldMissingPartials(tmpDir, ["FOOBAR"]);
    const content = await readFile(join(tmpDir, ".agents", "FOOBAR.md"), "utf8");
    expect(content).toMatch(/^## FOOBAR/);
    expect(content).toContain("<!--");
    expect(content).toContain("FOOBAR");
  });

  it("scaffolds multiple missing partials in one call", async () => {
    await scaffoldMissingPartials(tmpDir, ["PROJECT", "REVIEW", "FOOBAR"]);
    for (const name of ["PROJECT", "REVIEW", "FOOBAR"]) {
      const s = await stat(join(tmpDir, ".agents", `${name}.md`));
      expect(s.isFile()).toBe(true);
    }
  });
});
