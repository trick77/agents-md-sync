import { describe, expect, it } from "vitest";
import { buildCommitMessage, buildPrDescription, extractLastSyncSha, SYNC_TRAILER_PREFIX, type CommitInfo } from "../src/drift.js";

const LABEL = "TOOLING/agents-md-templates";

function commit(id: string, message: string): CommitInfo {
  return { id, message, authorTimestamp: 0 };
}

describe("extractLastSyncSha", () => {
  it("returns null when no trailer is present", () => {
    expect(extractLastSyncSha([commit("a", "chore: something")], LABEL)).toBeNull();
  });

  it("finds the trailer matching the template repo label", () => {
    const msg = `chore: update AGENTS.md\n\n${SYNC_TRAILER_PREFIX} ${LABEL}@deadbeef`;
    expect(extractLastSyncSha([commit("a", msg)], LABEL)).toBe("deadbeef");
  });

  it("ignores trailers for other template repos", () => {
    const msg = `${SYNC_TRAILER_PREFIX} OTHER/repo@deadbeef`;
    expect(extractLastSyncSha([commit("a", msg)], LABEL)).toBeNull();
  });

  it("returns the first (most recent) matching trailer", () => {
    const commits = [
      commit("new", `${SYNC_TRAILER_PREFIX} ${LABEL}@new`),
      commit("old", `${SYNC_TRAILER_PREFIX} ${LABEL}@old`),
    ];
    expect(extractLastSyncSha(commits, LABEL)).toBe("new");
  });
});

describe("buildPrDescription", () => {
  it("says no prior sync when lastSyncSha is null", () => {
    const desc = buildPrDescription({
      templateRepoLabel: LABEL,
      centralSha: "abc",
      lastSyncSha: null,
      upstreamCommitsSinceLastSync: [],
      included: ["CODING"],
      skipped: [],
      withCustom: [],
    });
    expect(desc).toContain("No prior sync");
    expect(desc).toContain(`${SYNC_TRAILER_PREFIX} ${LABEL}@abc`);
  });

  it("says no upstream changes when drift list is empty but prior sync exists", () => {
    const desc = buildPrDescription({
      templateRepoLabel: LABEL,
      centralSha: "abc",
      lastSyncSha: "old",
      upstreamCommitsSinceLastSync: [],
      included: [],
      skipped: [],
      withCustom: [],
    });
    expect(desc).toContain("No upstream changes");
  });

  it("lists upstream commits when drift is present", () => {
    const desc = buildPrDescription({
      templateRepoLabel: LABEL,
      centralSha: "abc",
      lastSyncSha: "old",
      upstreamCommitsSinceLastSync: [
        commit("1234567890abcdef", "feat: tighten testing rules"),
        commit("fedcba0987654321", "fix: typo in CODING.md\n\nextra body"),
      ],
      included: ["CODING"],
      skipped: [],
      withCustom: [],
    });
    expect(desc).toContain("`1234567890` feat: tighten testing rules");
    expect(desc).toContain("`fedcba0987` fix: typo in CODING.md");
    expect(desc).not.toContain("extra body");
  });
});

describe("buildCommitMessage", () => {
  it("includes the trailer", () => {
    const msg = buildCommitMessage(LABEL, "abc");
    expect(msg).toContain(`${SYNC_TRAILER_PREFIX} ${LABEL}@abc`);
    expect(msg.startsWith("chore: update AGENTS.md")).toBe(true);
  });
});
