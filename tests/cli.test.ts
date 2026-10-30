import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ENTRY = resolve(HERE, "..", "src", "index.ts");
const PKG = JSON.parse(readFileSync(resolve(HERE, "..", "package.json"), "utf8")) as {
  version: string;
};

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", ENTRY, ...args], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("CLI", () => {
  it("prints usage and examples and exits 0 when no args are passed", () => {
    const { status, stdout } = runCli([]);
    expect(status).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("Examples:");
    expect(stdout).toContain("--check");
    expect(stdout).not.toContain("--apply");
  }, 30_000);

  it("prints the version with --version", () => {
    const { status, stdout } = runCli(["--version"]);
    expect(status).toBe(0);
    expect(stdout).toContain(PKG.version);
  }, 30_000);

  it("fails when --template-dir or --profile is missing", () => {
    const { status, stderr } = runCli(["--repo", "."]);
    expect(status).not.toBe(0);
    expect(stderr).toContain("--template-dir");
  }, 30_000);

  it("rejects removed multi-repo flags", () => {
    const { status, stderr } = runCli(["--template-dir", "t", "--profile", "p", "--config", "targets.json"]);
    expect(status).not.toBe(0);
    expect(stderr).toContain("unknown option");
  }, 30_000);

  it("fails with exit 1 on an unknown profile", () => {
    const { status, stderr } = runCli([
      "--template-dir",
      resolve(HERE, "..", "examples", "template-repo"),
      "--profile",
      "nope",
      "--check",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain('Unknown profile "nope"');
  }, 30_000);
});
