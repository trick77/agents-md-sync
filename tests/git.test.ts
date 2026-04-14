import { describe, expect, it } from "vitest";
import { remoteToProjectRepo } from "../src/git.js";

describe("remoteToProjectRepo", () => {
  it("parses Bitbucket DC HTTPS remotes with /scm/ prefix", () => {
    expect(remoteToProjectRepo("https://bitbucket.company.com/scm/ABC/my-service.git")).toEqual({
      projectKey: "ABC",
      repoSlug: "my-service",
    });
  });

  it("parses HTTPS remotes without .git suffix", () => {
    expect(remoteToProjectRepo("https://bitbucket.company.com/scm/abc/my-service")).toEqual({
      projectKey: "ABC",
      repoSlug: "my-service",
    });
  });

  it("parses ssh:// style remotes", () => {
    expect(remoteToProjectRepo("ssh://git@bitbucket.company.com:7999/ABC/my-service.git")).toEqual({
      projectKey: "ABC",
      repoSlug: "my-service",
    });
  });

  it("parses SCP-style SSH remotes", () => {
    expect(remoteToProjectRepo("git@bitbucket.company.com:ABC/my-service.git")).toEqual({
      projectKey: "ABC",
      repoSlug: "my-service",
    });
  });

  it("uppercases the project key", () => {
    expect(remoteToProjectRepo("git@bitbucket.company.com:abc/repo.git").projectKey).toBe("ABC");
  });

  it("throws for unparseable URLs", () => {
    expect(() => remoteToProjectRepo("not-a-url")).toThrow();
  });
});
