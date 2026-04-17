import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertIsGitRepo, gitIn } from "../src/git.js";

describe("assertIsGitRepo", () => {
  it("rejects with a friendly message naming the path for a non-git directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agents-md-notrepo-"));
    await expect(assertIsGitRepo(gitIn(dir), dir)).rejects.toThrow(
      /Target directory is not a git repository/,
    );
    await expect(assertIsGitRepo(gitIn(dir), dir)).rejects.toThrow(dir);
  });

  it("resolves for an initialized git repository", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agents-md-repo-"));
    const git = gitIn(dir);
    await git.init();
    await expect(assertIsGitRepo(git, dir)).resolves.toBeUndefined();
  });
});
