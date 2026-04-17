import { describe, expect, it } from "vitest";
import { compose } from "../src/compose.js";
import { renderPreviewLines } from "../src/sync.js";

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string): string => s.replace(ANSI, "");

describe("renderPreviewLines", () => {
  it("shows template, profile, per-partial source lines and a composed-size summary", () => {
    const result = compose({
      skeleton:
        "<!-- include: PROJECT.md -->\n<!-- include: CODING.md -->\n<!-- include: TESTING.md -->\n<!-- include: REVIEW.md -->\n",
      centralPartials: {
        CODING: "## Coding\n- rule",
        TESTING: "## Testing\n- rule",
        REVIEW: "## Review\n- rule",
      },
      customPartials: {
        PROJECT: "## Project\n- local only",
        CODING: "- repo-specific",
      },
      skip: ["REVIEW"],
    });

    const lines = renderPreviewLines(result, "TOOLING/agents-md-templates", "angular");
    const joined = stripAnsi(lines.join("\n"));

    expect(joined).toContain("template: TOOLING/agents-md-templates (profile: angular)");
    expect(joined).toContain("partials (4 total)");
    expect(joined).toMatch(/✓ PROJECT\s+local only/);
    expect(joined).toContain(".agents/PROJECT.md");
    expect(joined).toMatch(/✓ CODING\s+central\+local/);
    expect(joined).toContain("addendum from .agents/CODING.md");
    expect(joined).toMatch(/✓ TESTING\s+central only/);
    expect(joined).toMatch(/✗ REVIEW\s+skipped \(listed in target\.skip\)/);
    expect(joined).toContain("composed AGENTS.md:");
    expect(joined).toContain("included 3");
    expect(joined).toContain("skipped 1");
    expect(joined).toContain("addenda on 2");
    expect(joined).toContain("[preview]");
  });

  it("does not include the composed content in any line", () => {
    const result = compose({
      skeleton: "<!-- include: CODING.md -->\n",
      centralPartials: { CODING: "## Coding\n- THE_SECRET_MARKER" },
      customPartials: {},
      skip: [],
    });
    const joined = stripAnsi(renderPreviewLines(result, "tpl", "p").join("\n"));
    expect(joined).not.toContain("THE_SECRET_MARKER");
    expect(joined).not.toContain("## Coding");
  });

  it("reports missing partials explicitly", () => {
    const result = compose({
      skeleton: "<!-- include: NOPE.md -->\n",
      centralPartials: {},
      customPartials: {},
      skip: [],
    });
    const joined = stripAnsi(renderPreviewLines(result, "tpl", "p").join("\n"));
    expect(joined).toMatch(/! NOPE\s+MISSING/);
  });

  it("labels scaffold candidates as 'will be scaffolded on --apply', not MISSING", () => {
    const result = compose({
      skeleton: "<!-- include: PROJECT.md -->\n",
      centralPartials: {},
      customPartials: {},
      skip: [],
    });
    const joined = stripAnsi(renderPreviewLines(result, "tpl", "p", ["PROJECT"]).join("\n"));
    expect(joined).toMatch(/\+ PROJECT\s+will be scaffolded at \.agents\/PROJECT\.md on --apply/);
    expect(joined).not.toContain("MISSING");
    expect(joined).toContain("to scaffold 1");
  });
});
