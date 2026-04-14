import { logger } from "./logger.js";

export interface BitbucketClientOptions {
  baseUrl: string;
  token: string;
}

export interface RepoRef {
  projectKey: string;
  repoSlug: string;
}

export class BitbucketError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "BitbucketError";
  }
}

export class BitbucketClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(opts: BitbucketClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.headers = { Authorization: `Bearer ${opts.token}` };
  }

  async findOpenPullRequest(
    ref: RepoRef,
    fromBranch: string,
    toBranch: string,
  ): Promise<{ id: number; url: string } | null> {
    const url = this.url(
      `/rest/api/1.0/projects/${ref.projectKey}/repos/${ref.repoSlug}/pull-requests?state=OPEN&at=${encodeURIComponent(`refs/heads/${fromBranch}`)}&direction=OUTGOING&limit=25`,
    );
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new BitbucketError(res.status, `GET ${url} failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      values?: Array<{
        id: number;
        toRef?: { displayId?: string };
        fromRef?: { displayId?: string };
        links?: { self?: Array<{ href: string }> };
      }>;
    };
    const hit = (body.values ?? []).find(
      (p) => p.fromRef?.displayId === fromBranch && p.toRef?.displayId === toBranch,
    );
    if (!hit) return null;
    return { id: hit.id, url: hit.links?.self?.[0]?.href ?? "" };
  }

  async updatePullRequestDescription(
    ref: RepoRef,
    id: number,
    title: string,
    description: string,
  ): Promise<void> {
    const getUrl = this.url(
      `/rest/api/1.0/projects/${ref.projectKey}/repos/${ref.repoSlug}/pull-requests/${id}`,
    );
    const getRes = await fetch(getUrl, { headers: this.headers });
    if (!getRes.ok) throw new BitbucketError(getRes.status, `GET ${getUrl} failed: ${getRes.status}`);
    const current = (await getRes.json()) as { version: number };

    const putRes = await fetch(getUrl, {
      method: "PUT",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ version: current.version, title, description }),
    });
    if (!putRes.ok)
      throw new BitbucketError(putRes.status, `PUT ${getUrl} failed: ${putRes.status} ${await putRes.text()}`);
    logger.debug(`updated PR ${ref.projectKey}/${ref.repoSlug}#${id}`);
  }

  async createPullRequest(
    ref: RepoRef,
    fromBranch: string,
    toBranch: string,
    title: string,
    description: string,
  ): Promise<{ id: number; url: string }> {
    const url = this.url(`/rest/api/1.0/projects/${ref.projectKey}/repos/${ref.repoSlug}/pull-requests`);
    const payload = {
      title,
      description,
      fromRef: { id: `refs/heads/${fromBranch}`, repository: { slug: ref.repoSlug, project: { key: ref.projectKey } } },
      toRef: { id: `refs/heads/${toBranch}`, repository: { slug: ref.repoSlug, project: { key: ref.projectKey } } },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new BitbucketError(res.status, `POST ${url} failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { id: number; links?: { self?: Array<{ href: string }> } };
    const prUrl = body.links?.self?.[0]?.href ?? "";
    return { id: body.id, url: prUrl };
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
