import { invalidateSession } from "@infrastructure/reddit/reddit-auth.js";
import { REDDIT_API_BASE } from "@infrastructure/reddit/reddit.constants.js";
import { clearPostCache, fetchTopPosts } from "@infrastructure/reddit/reddit.client.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

const LOID = "0000000000abcdef";
const SESSION = "session-token";

function tokenResponse(): unknown {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ access_token: "token-1", expires_in: 86_400 }),
    text: () => Promise.resolve(""),
    headers: {
      get: (name: string) => ({ "x-reddit-loid": LOID, "x-reddit-session": SESSION })[name.toLowerCase()] ?? null,
    },
  };
}

function child(data: Record<string, unknown>): unknown {
  return { data: { id: "a1", title: "Un titulo", selftext: "cuerpo", ...data } };
}

function listingResponse(children: unknown[]): unknown {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: { children } }),
    text: () => Promise.resolve(""),
    headers: { get: () => null },
  };
}

function errorResponse(status: number): unknown {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("blocked"),
    headers: { get: () => null },
  };
}

function headersOf(call: number): Record<string, string> {
  return (fetchMock.mock.calls[call]?.[1] as { headers: Record<string, string> }).headers;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  invalidateSession();
  clearPostCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateSession();
  clearPostCache();
});

describe("fetchTopPosts", () => {
  // Normal case: a listing is mapped down to the fields the copypasta feature needs.
  it("maps the listing into posts", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));

    expect(await fetchTopPosts("copypasta_es", "week", 25)).toEqual([
      { id: "a1", title: "Un titulo", selftext: "cuerpo" },
    ]);
  });

  // Normal case: the subreddit, timeframe and limit all have to reach the API call.
  it("requests the top listing for the given subreddit", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));

    await fetchTopPosts("copypasta_es", "week", 25);

    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${REDDIT_API_BASE}/r/copypasta_es/top?t=week&limit=25&raw_json=1`);
  });

  // Normal case: the listing call must present the minted token as a bearer credential.
  it("authorizes the listing call with the minted token", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));

    await fetchTopPosts("copypasta_es", "week", 25);

    expect(headersOf(1)["Authorization"]).toBe("Bearer token-1");
  });

  // This is what makes the traffic look like one device rather than a rotating swarm.
  it("reuses the token call's device identity on the listing call", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));

    await fetchTopPosts("copypasta_es", "week", 25);

    expect(headersOf(1)["User-Agent"]).toBe(headersOf(0)["User-Agent"]);
    expect(headersOf(1)["X-Reddit-Device-Id"]).toBe(headersOf(0)["X-Reddit-Device-Id"]);
  });

  // Normal case: the loid and session handed back at mint time must be replayed on the data call.
  it("replays the captured loid and session headers", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));

    await fetchTopPosts("copypasta_es", "week", 25);

    expect(headersOf(1)["x-reddit-loid"]).toBe(LOID);
    expect(headersOf(1)["x-reddit-session"]).toBe(SESSION);
  });

  // Edge case: pinned mod posts are not copypastas and must be dropped.
  it("skips stickied posts", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(listingResponse([child({ stickied: true }), child({ id: "b2" })]));

    const posts = await fetchTopPosts("copypasta_es", "week", 25);

    expect(posts?.map((post) => post.id)).toEqual(["b2"]);
  });

  // Edge case: a malformed child without an id or title cannot be posted and must be dropped.
  it("skips entries missing an id or a title", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        listingResponse([{ data: {} }, child({ id: undefined }), child({ title: undefined }), child({ id: "c3" })]),
      );

    const posts = await fetchTopPosts("copypasta_es", "week", 25);

    expect(posts?.map((post) => post.id)).toEqual(["c3"]);
  });

  // Edge case: a link post has no body, which must default to an empty string rather than undefined.
  it("defaults a missing body to an empty string", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(listingResponse([child({ selftext: undefined })]));

    expect((await fetchTopPosts("copypasta_es", "week", 25))?.[0]?.selftext).toBe("");
  });

  // Error handling: an expired token must be replaced and the call retried exactly once.
  it("re-mints the token once on a 401 and retries", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(listingResponse([child({})]));

    const posts = await fetchTopPosts("copypasta_es", "week", 25);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(posts?.[0]?.id).toBe("a1");
  });

  // Error handling: a persistent 401 must stop after one retry rather than looping.
  it("gives up after a single retry when the 401 persists", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(errorResponse(401));

    expect(await fetchTopPosts("copypasta_es", "week", 25)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  // Error handling: a block is the failure this whole client exists to survive.
  it("returns undefined on a 403 with nothing cached", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(errorResponse(403));

    expect(await fetchTopPosts("copypasta_es", "week", 25)).toBeUndefined();
  });

  // Error handling: rate limiting must not be retried in a tight loop.
  it("returns undefined on a 429 without retrying", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(errorResponse(429));

    expect(await fetchTopPosts("copypasta_es", "week", 25)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Error handling: a failed mint means there is no credential, so no listing call should happen.
  it("returns undefined when the token cannot be minted", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403));

    expect(await fetchTopPosts("copypasta_es", "week", 25)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Error handling: a network failure must be caught rather than rejecting into the task.
  it("returns undefined when the listing request throws", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockRejectedValueOnce(new Error("ECONNRESET"));

    expect(await fetchTopPosts("copypasta_es", "week", 25)).toBeUndefined();
  });

  // Edge case: an empty subreddit gives nothing to post and must not be cached as a good result.
  it("returns undefined when the listing is empty", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([]));

    expect(await fetchTopPosts("copypasta_es", "week", 25)).toBeUndefined();
  });

  // This is the resilience the feature depends on: a block costs freshness, not the pasta.
  it("serves the last successful listing when a later fetch is blocked", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));
    const first = await fetchTopPosts("copypasta_es", "week", 25);

    fetchMock.mockResolvedValueOnce(errorResponse(403));
    const second = await fetchTopPosts("copypasta_es", "week", 25);

    expect(second).toEqual(first);
  });

  // Error handling: the fallback is per-listing, so a blocked subreddit must not serve another one's posts.
  it("does not serve one subreddit's cached listing for another", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));
    await fetchTopPosts("copypasta_es", "week", 25);

    fetchMock.mockResolvedValueOnce(errorResponse(403));

    expect(await fetchTopPosts("memes_es", "day", 25)).toBeUndefined();
  });

  // Edge case: the same listing asked for with a different timeframe is a different cache entry.
  it("keys the cached listing by timeframe and limit", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));
    await fetchTopPosts("copypasta_es", "week", 25);

    fetchMock.mockResolvedValueOnce(errorResponse(403));

    expect(await fetchTopPosts("copypasta_es", "week", 50)).toBeUndefined();
  });

  // Edge case: once the cache is cleared there is nothing to fall back to.
  it("stops serving the cached listing after it is cleared", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listingResponse([child({})]));
    await fetchTopPosts("copypasta_es", "week", 25);

    clearPostCache();
    fetchMock.mockResolvedValueOnce(errorResponse(403));

    expect(await fetchTopPosts("copypasta_es", "week", 25)).toBeUndefined();
  });
});
