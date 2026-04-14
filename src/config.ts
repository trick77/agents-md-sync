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
  bitbucketBaseUrl: z.string().url(),
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
