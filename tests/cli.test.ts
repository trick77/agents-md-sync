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
});
