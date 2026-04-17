import { simpleGit, type SimpleGit } from "simple-git";

export interface RepoRef {
  projectKey: string;
  repoSlug: string;
}

export function gitIn(dir: string): SimpleGit {
  return simpleGit(dir);
}

export async function assertIsGitRepo(git: SimpleGit, absPath: string): Promise<void> {
  const ok = await git.checkIsRepo().catch(() => false);
  if (!ok) {
    throw new Error(
      `Target directory is not a git repository: ${absPath}. ` +
        `agents-md-sync commits and pushes AGENTS.md, so each target must be a git working copy.`,
    );
  }
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
