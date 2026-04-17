import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = resolve(HERE, "..", "src", "index.ts");

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("npx", ["--yes", "tsx", ENTRY, ...args], {
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("CLI", () => {
  it("prints usage and examples and exits 0 when no args are passed", () => {
    const { status, stdout } = runCli([]);
    expect(status).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("Examples:");
    expect(stdout).toContain("--apply");
    expect(stdout).toContain("--show-output");
    expect(stdout).toContain("Getting started:");
  }, 30_000);

  it("prints usage and exits 0 when --config is omitted but other flags are present", () => {
    const { status, stdout } = runCli(["--apply"]);
    expect(status).toBe(0);
    expect(stdout).toContain("Examples:");
  }, 30_000);

  it("warns that apply-only flags are ignored when --apply is not set", () => {
    const { stderr } = runCli([
      "--config",
      "/dev/null/nope",
      "--autostash",
      "--allow-dirty",
      "--pr",
      "--force",
    ]);
    expect(stderr).toContain("--pr");
    expect(stderr).toContain("--autostash");
    expect(stderr).toContain("--allow-dirty");
    expect(stderr).toContain("--force");
    expect(stderr).toContain("no effect without --apply");
  }, 30_000);
});
