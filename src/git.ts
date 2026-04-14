import { simpleGit, type SimpleGit } from "simple-git";
import type { CommitInfo } from "./drift.js";

export interface RepoRef {
  projectKey: string;
  repoSlug: string;
}

export function gitIn(dir: string): SimpleGit {
  return simpleGit(dir);
}

export async function assertCleanWorkingTree(git: SimpleGit): Promise<void> {
  const status = await git.status();
  if (!status.isClean()) {
    throw new Error(
      `Working tree is not clean (${status.files.length} changed file(s)). ` +
        `Commit/stash changes, or pass --autostash (recommended) or --allow-dirty.`,
    );
  }
}

export async function getHeadRef(git: SimpleGit): Promise<string> {
  try {
    const raw = await git.raw(["symbolic-ref", "--short", "HEAD"]);
    return raw.trim();
  } catch {
    return (await git.revparse(["HEAD"])).trim();
  }
}

export async function stashPush(git: SimpleGit, message: string): Promise<boolean> {
  const status = await git.status();
  if (status.isClean()) return false;
  await git.raw(["stash", "push", "--include-untracked", "-m", message]);
  return true;
}

export async function stashPop(git: SimpleGit): Promise<void> {
  await git.raw(["stash", "pop"]);
}

export async function detectDefaultBranch(git: SimpleGit): Promise<string> {
  try {
    const raw = await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const trimmed = raw.trim();
    const prefix = "refs/remotes/origin/";
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  } catch {
    // fall through
  }
  const remoteShow = await git.raw(["remote", "show", "origin"]);
  const match = remoteShow.match(/HEAD branch:\s*(\S+)/);
  if (match && match[1]) return match[1];
  throw new Error("could not determine default branch from origin");
}

export async function prepareTargetRepo(
  git: SimpleGit,
  defaultBranch: string,
  prBranch: string,
): Promise<void> {
  await git.fetch(["origin", "--prune"]);
  await git.checkout(defaultBranch);
  await git.reset(["--hard", `origin/${defaultBranch}`]);
  const branches = await git.branchLocal();
  if (branches.all.includes(prBranch)) {
    await git.deleteLocalBranch(prBranch, true);
  }
  await git.checkoutBranch(prBranch, defaultBranch);
}

export async function hasStagedChanges(git: SimpleGit): Promise<boolean> {
  const status = await git.status();
  return status.files.length > 0;
}

export async function commitSyncChanges(
  git: SimpleGit,
  files: string[],
  message: string,
): Promise<string> {
  await git.add(files);
  await git.commit(message, undefined, { "--allow-empty": null });
  return (await git.revparse(["HEAD"])).trim();
}

export async function pushBranch(git: SimpleGit, branch: string): Promise<void> {
  await git.push("origin", branch, ["--force"]);
}

export async function readLastSyncSha(
  git: SimpleGit,
  defaultBranch: string,
): Promise<{ sha: string; templateDir: string } | null> {
  try {
    const out = await git.raw([
      "log",
      defaultBranch,
      "--grep=X-AgentsMd-Sync-Source:",
      "-n",
      "1",
      "--format=%B",
    ]);
    const match = out.match(/X-AgentsMd-Sync-Source:\s*([^\s@]+)@([0-9a-f]+)/);
    if (!match || !match[1] || !match[2]) return null;
    return { templateDir: match[1], sha: match[2] };
  } catch {
    return null;
  }
}

export async function templateHeadSha(git: SimpleGit): Promise<string> {
  return (await git.revparse(["HEAD"])).trim();
}

export async function templateCommitsSince(
  git: SimpleGit,
  sinceSha: string,
  profile: string,
): Promise<CommitInfo[]> {
  try {
    const range = `${sinceSha}..HEAD`;
    const out = await git.raw([
      "log",
      range,
      "--format=%H%x1f%at%x1f%B%x1e",
      "--",
      `profiles/${profile}`,
      "common",
    ]);
    return parseCommits(out);
  } catch {
    return [];
  }
}

function parseCommits(raw: string): CommitInfo[] {
  const out: CommitInfo[] = [];
  for (const entry of raw.split("\x1e").map((c) => c.trim()).filter(Boolean)) {
    const [id, ts, message] = entry.split("\x1f");
    if (!id) continue;
    out.push({ id, message: (message ?? "").trim(), authorTimestamp: Number(ts) || 0 });
  }
  return out;
}

export function remoteToProjectRepo(url: string): RepoRef {
  const cleaned = url.trim().replace(/\.git$/, "");
  const patterns = [
    /^https?:\/\/[^/]+\/(?:scm\/)?([^/]+)\/([^/]+)$/i,
    /^ssh:\/\/[^/]+\/([^/]+)\/([^/]+)$/i,
    /^[^@]+@[^:]+:([^/]+)\/([^/]+)$/,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m && m[1] && m[2]) return { projectKey: m[1].toUpperCase(), repoSlug: m[2] };
  }
  throw new Error(`Cannot parse projectKey/repoSlug from remote URL: ${url}`);
}
