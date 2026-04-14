import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BitbucketClient, BitbucketError } from "../src/bitbucket.js";

type FetchCall = { url: string; init?: RequestInit };

function mockFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown; text?: string }>) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = vi.fn((url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = responses[i++];
    if (!r) throw new Error(`unexpected fetch #${i} to ${url}`);
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: () => Promise.resolve(r.body ?? {}),
      text: () => Promise.resolve(r.text ?? ""),
    } as Response);
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

const ref = { projectKey: "ABC", repoSlug: "my-service" };

describe("BitbucketClient", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("trims trailing slashes from baseUrl and sends bearer token", async () => {
    const { calls } = mockFetch([{ ok: true, body: { values: [] } }]);
    const client = new BitbucketClient({ baseUrl: "https://bb.example.com///", token: "tok" });
    await client.findOpenPullRequest(ref, "feature/x", "master");
    expect(calls[0]?.url).toMatch(/^https:\/\/bb\.example\.com\/rest\/api\/1\.0\//);
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  describe("findOpenPullRequest", () => {
    it("returns matching open PR id and url", async () => {
      mockFetch([
        {
          ok: true,
          body: {
            values: [
              {
                id: 42,
                fromRef: { displayId: "feature/x" },
                toRef: { displayId: "master" },
                links: { self: [{ href: "https://bb.example.com/pr/42" }] },
              },
            ],
          },
        },
      ]);
      const client = new BitbucketClient({ baseUrl: "https://bb.example.com", token: "tok" });
      const hit = await client.findOpenPullRequest(ref, "feature/x", "master");
      expect(hit).toEqual({ id: 42, url: "https://bb.example.com/pr/42" });
    });

    it("returns null when no PR matches from/to branches", async () => {
      mockFetch([{ ok: true, body: { values: [] } }]);
      const client = new BitbucketClient({ baseUrl: "https://bb.example.com", token: "tok" });
      expect(await client.findOpenPullRequest(ref, "feature/x", "master")).toBeNull();
    });

    it("throws BitbucketError on non-ok response", async () => {
      mockFetch([{ ok: false, status: 401, text: "unauth" }]);
      const client = new BitbucketClient({ baseUrl: "https://bb.example.com", token: "tok" });
      await expect(client.findOpenPullRequest(ref, "feature/x", "master")).rejects.toBeInstanceOf(
        BitbucketError,
      );
    });
  });

  describe("createPullRequest", () => {
    it("POSTs the PR payload and returns id+url", async () => {
      const { calls } = mockFetch([
        {
          ok: true,
          body: { id: 7, links: { self: [{ href: "https://bb.example.com/pr/7" }] } },
        },
      ]);
      const client = new BitbucketClient({ baseUrl: "https://bb.example.com", token: "tok" });
      const pr = await client.createPullRequest(ref, "feature/x", "master", "title", "body");
      expect(pr).toEqual({ id: 7, url: "https://bb.example.com/pr/7" });
      expect(calls[0]?.init?.method).toBe("POST");
      const payload = JSON.parse(calls[0]?.init?.body as string) as {
        fromRef: { id: string };
        toRef: { id: string };
      };
      expect(payload.fromRef.id).toBe("refs/heads/feature/x");
      expect(payload.toRef.id).toBe("refs/heads/master");
    });

    it("throws BitbucketError on failure", async () => {
      mockFetch([{ ok: false, status: 409, text: "conflict" }]);
      const client = new BitbucketClient({ baseUrl: "https://bb.example.com", token: "tok" });
      await expect(
        client.createPullRequest(ref, "feature/x", "master", "t", "b"),
      ).rejects.toBeInstanceOf(BitbucketError);
    });
  });

  describe("updatePullRequestDescription", () => {
    it("fetches current version then PUTs the update", async () => {
      const { calls } = mockFetch([
        { ok: true, body: { version: 3 } },
        { ok: true, body: {} },
      ]);
      const client = new BitbucketClient({ baseUrl: "https://bb.example.com", token: "tok" });
      await client.updatePullRequestDescription(ref, 42, "t", "b");
      expect(calls[1]?.init?.method).toBe("PUT");
      const payload = JSON.parse(calls[1]?.init?.body as string) as { version: number };
      expect(payload.version).toBe(3);
    });

    it("throws on GET failure", async () => {
      mockFetch([{ ok: false, status: 404 }]);
      const client = new BitbucketClient({ baseUrl: "https://bb.example.com", token: "tok" });
      await expect(client.updatePullRequestDescription(ref, 1, "t", "b")).rejects.toBeInstanceOf(
        BitbucketError,
      );
    });

    it("throws on PUT failure", async () => {
      mockFetch([
        { ok: true, body: { version: 1 } },
        { ok: false, status: 500, text: "boom" },
      ]);
      const client = new BitbucketClient({ baseUrl: "https://bb.example.com", token: "tok" });
      await expect(client.updatePullRequestDescription(ref, 1, "t", "b")).rejects.toBeInstanceOf(
        BitbucketError,
      );
    });
  });
});
