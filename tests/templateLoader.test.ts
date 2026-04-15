import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTemplate } from "../src/templateLoader.js";

async function makeTemplateRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agents-md-tpl-"));
  await mkdir(join(root, "common"), { recursive: true });
  await mkdir(join(root, "profiles", "angular"), { recursive: true });
  await writeFile(join(root, "common", "REVIEW.md"), "## Review (common)", "utf8");
  await writeFile(join(root, "common", "DO_NOT.md"), "## Do Not (common)", "utf8");
  await writeFile(
    join(root, "profiles", "angular", "AGENTS.md.tmpl"),
    "# A\n<!-- include: REVIEW.md -->\n",
    "utf8",
  );
  await writeFile(
    join(root, "profiles", "angular", "CODING.md"),
    "## Coding (angular)",
    "utf8",
  );
  return root;
}

describe("loadTemplate", () => {
  it("merges common and profile partials, profile wins on conflict", async () => {
    const root = await makeTemplateRepo();
    await writeFile(join(root, "profiles", "angular", "REVIEW.md"), "## Review (angular)", "utf8");

    const t = await loadTemplate(root, "angular", "abc123");

    expect(t.centralSha).toBe("abc123");
    expect(t.skeleton).toContain("<!-- include: REVIEW.md -->");
    expect(t.partials["CODING"]).toContain("angular");
    expect(t.partials["DO_NOT"]).toContain("common");
    expect(t.partials["REVIEW"]).toBe("## Review (angular)");
  });

  it("merges only common partials when the profile dir has no extra markdown", async () => {
    const root = await makeTemplateRepo();
    const t = await loadTemplate(root, "angular", "sha");
    expect(t.partials["CODING"]).toBeDefined();
    expect(Object.keys(t.partials).sort()).toEqual(["CODING", "DO_NOT", "REVIEW"]);
  });

  it("throws when the profile directory does not exist", async () => {
    const root = await makeTemplateRepo();
    await expect(loadTemplate(root, "missing-profile", "sha")).rejects.toThrow();
  });

  it("falls back to the default skeleton when the profile has no AGENTS.md.tmpl", async () => {
    const root = await mkdtemp(join(tmpdir(), "agents-md-tpl-"));
    await mkdir(join(root, "common"), { recursive: true });
    await mkdir(join(root, "profiles", "angular"), { recursive: true });
    await writeFile(join(root, "profiles", "angular", "CODING.md"), "## Coding", "utf8");

    const t = await loadTemplate(root, "angular", "sha");

    expect(t.skeleton).toContain("# Agent Instructions");
    expect(t.skeleton).toContain("<!-- include: PROJECT.md -->");
    expect(t.skeleton).toContain("<!-- include: DO_NOT.md -->");
  });

  it("uses a profile-provided skeleton over the default", async () => {
    const root = await mkdtemp(join(tmpdir(), "agents-md-tpl-"));
    await mkdir(join(root, "profiles", "angular"), { recursive: true });
    await writeFile(
      join(root, "profiles", "angular", "AGENTS.md.tmpl"),
      "# Custom\n<!-- include: CODING.md -->\n",
      "utf8",
    );
    await writeFile(join(root, "profiles", "angular", "CODING.md"), "## Coding", "utf8");

    const t = await loadTemplate(root, "angular", "sha");

    expect(t.skeleton).toBe("# Custom\n<!-- include: CODING.md -->\n");
  });
});
