import { basename, resolve } from "node:path";

export interface Config {
  repoDir: string;
  templateDir: string;
  profile: string;
  skip: string[];
}

export interface ConfigInput {
  repo?: string;
  templateDir: string;
  profile: string;
  skip?: string[];
  baseDir?: string;
}

/** Resolve CLI flags into absolute paths. Relative paths are taken from `baseDir` (default: cwd). */
export function buildConfig(o: ConfigInput): Config {
  if (o.templateDir.trim() === "") throw new Error("--template-dir must not be empty");
  // A profile is a directory name under profiles/, never a path.
  if (o.profile === "" || basename(o.profile) !== o.profile) {
    throw new Error(`--profile must be a plain directory name, got "${o.profile}"`);
  }
  const base = o.baseDir ?? process.cwd();
  return {
    repoDir: resolve(base, o.repo ?? "."),
    templateDir: resolve(base, o.templateDir),
    profile: o.profile,
    skip: o.skip ?? [],
  };
}
