import { describe, expect, it } from "vitest";
import { summarizePreview } from "../src/sync.js";

describe("summarizePreview", () => {
  it("reports size and included partials", () => {
    const body = "x".repeat(1024 * 2); // 2.0 KB
    const out = summarizePreview(body, {
      included: ["CODING", "TESTING"],
      skipped: [],
      withCustom: [],
    });
    expect(out).toContain("would write AGENTS.md (2.0 KB)");
    expect(out).toContain("included: CODING, TESTING");
    expect(out).not.toContain("skipped:");
    expect(out).not.toContain("addenda:");
  });

  it("includes skipped and addenda sections when present", () => {
    const out = summarizePreview("body", {
      included: ["CODING"],
      skipped: ["REVIEW"],
      withCustom: ["CODING"],
    });
    expect(out).toContain("skipped: REVIEW");
    expect(out).toContain("addenda: CODING");
  });

  it("says 'included: none' when the result has no included partials", () => {
    const out = summarizePreview("body", { included: [], skipped: [], withCustom: [] });
    expect(out).toContain("included: none");
  });
});
