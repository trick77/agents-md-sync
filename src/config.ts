import { readFile } from "node:fs/promises";
import { z } from "zod";

const TargetSchema = z.object({
  dir: z.string().min(1),
  profile: z.string().min(1),
  skip: z.array(z.string()).default([]),
});

export const ConfigSchema = z.object({
  localGitBaseDir: z.string().min(1),
  templateDir: z.string().min(1),
  // Only required for --apply --pr; optional so the config-less single-repo
  // and --write-only modes work without a Bitbucket base URL.
  bitbucketBaseUrl: z.string().url().optional(),
  prBranch: z.string().min(1).default("feature/update-agents-md"),
  targets: z.array(TargetSchema).min(1),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Target = z.infer<typeof TargetSchema>;

export async function loadConfig(path: string): Promise<Config> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return ConfigSchema.parse(parsed);
}

export interface SingleRepoOptions {
  repo?: string;
  templateDir: string;
  profile: string;
  skip?: string[];
  bitbucketBaseUrl?: string;
  prBranch?: string;
  baseDir?: string;
}

/**
 * Build a single-target Config from CLI flags (config-less single-repo mode).
 * Paths are resolved relative to `baseDir` (default: process.cwd()); absolute
 * paths are used as-is.
 */
export function buildSingleTargetConfig(o: SingleRepoOptions): Config {
  return ConfigSchema.parse({
    localGitBaseDir: o.baseDir ?? process.cwd(),
    templateDir: o.templateDir,
    bitbucketBaseUrl: o.bitbucketBaseUrl,
    ...(o.prBranch ? { prBranch: o.prBranch } : {}),
    targets: [{ dir: o.repo ?? ".", profile: o.profile, skip: o.skip ?? [] }],
  });
}
