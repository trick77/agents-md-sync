import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCleanWorkingTree,
  commitSyncChanges,
  getHeadRef,
  gitIn,
  hasStagedChanges,
  readLastSyncSha,
  stashPop,
  stashPush,
  templateCommitsSince,
  templateHeadSha,
} from "../src/git.js";

async function makeRepo(): Promise<ReturnType<typeof gitIn>> {
  const dir = await mkdtemp(join(tmpdir(), "agents-md-git-"));
  const git = gitIn(dir);
  await git.init();
  await git.addConfig("user.email", "test@example.com");
  await git.addConfig("user.name", "test");
  await git.addConfig("commit.gpgsign", "false");
  await writeFile(join(dir, "README.md"), "hi", "utf8");
  await git.add("README.md");
  await git.commit("initial");
  return git;
}

describe("git helpers (real tmp repo)", () => {
  it("assertCleanWorkingTree passes on a clean repo and fails when dirty", async () => {
    const git = await makeRepo();
    await expect(assertCleanWorkingTree(git)).resolves.toBeUndefined();

    const dir = (await git.revparse(["--show-toplevel"])).trim();
    await writeFile(join(dir, "new.txt"), "x", "utf8");
    await expect(assertCleanWorkingTree(git)).rejects.toThrow(/not clean/);
  });

  it("getHeadRef returns the current branch name", async () => {
    const git = await makeRepo();
    const ref = await getHeadRef(git);
    expect(["main", "master"]).toContain(ref);
  });

  it("stashPush returns false when clean and true when dirty; stashPop restores", async () => {
    const git = await makeRepo();
    expect(await stashPush(git, "nothing")).toBe(false);

    const dir = (await git.revparse(["--show-toplevel"])).trim();
    await writeFile(join(dir, "x.txt"), "x", "utf8");
    expect(await stashPush(git, "wip")).toBe(true);
    await expect(assertCleanWorkingTree(git)).resolves.toBeUndefined();
    await stashPop(git);
    await expect(assertCleanWorkingTree(git)).rejects.toThrow();
  });

  it("commitSyncChanges commits and returns the new HEAD sha", async () => {
    const git = await makeRepo();
    const dir = (await git.revparse(["--show-toplevel"])).trim();
    await writeFile(join(dir, "AGENTS.md"), "# A", "utf8");
    const sha = await commitSyncChanges(git, ["AGENTS.md"], "sync: test\n\nX-AgentsMd-Sync-Source: tpl@deadbeef");
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(await hasStagedChanges(git)).toBe(false);
  });

  it("readLastSyncSha finds the trailer from a previous sync commit", async () => {
    const git = await makeRepo();
    const dir = (await git.revparse(["--show-toplevel"])).trim();
    await writeFile(join(dir, "AGENTS.md"), "# A", "utf8");
    await commitSyncChanges(git, ["AGENTS.md"], "sync: test\n\nX-AgentsMd-Sync-Source: TOOLING/tpl@deadbeefcafebabe0011");

    const branch = await getHeadRef(git);
    const last = await readLastSyncSha(git, branch);
    expect(last).toEqual({ templateDir: "TOOLING/tpl", sha: "deadbeefcafebabe0011" });
  });

  it("readLastSyncSha returns null when no sync trailer exists", async () => {
    const git = await makeRepo();
    const branch = await getHeadRef(git);
    expect(await readLastSyncSha(git, branch)).toBeNull();
  });

  it("templateHeadSha returns a 40-char sha", async () => {
    const git = await makeRepo();
    const sha = await templateHeadSha(git);
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("templateCommitsSince returns empty array when range is invalid", async () => {
    const git = await makeRepo();
    const out = await templateCommitsSince(git, "0000000000000000000000000000000000000000", "angular");
    expect(out).toEqual([]);
  });
});
