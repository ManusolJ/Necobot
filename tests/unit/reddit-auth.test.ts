import { getSession, invalidateSession } from "@infrastructure/reddit/reddit-auth.js";
import { ANDROID_CLIENT_ID, REDDIT_TOKEN_URL } from "@infrastructure/reddit/reddit.constants.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

const LOID = "0000000000abcdef";
const SESSION = "session-token";

/**
 * `expires_in: 120` cancels out exactly against the leeway, so the minted session is
 * already expired and the next call has to mint a fresh one.
 */
function tokenResponse(body: Record<string, unknown> = {}, headers: Record<string, string> = {}): unknown {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ access_token: "token-1", expires_in: 86_400, ...body }),
    text: () => Promise.resolve(""),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

function initOf(call: number): { method: string; headers: Record<string, string>; body: string } {
  return fetchMock.mock.calls[call]?.[1] as { method: string; headers: Record<string, string>; body: string };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  invalidateSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateSession();
});

describe("getSession", () => {
  // Normal case: a well-formed response yields a usable session with the returned token.
  it("returns a session carrying the access token", async () => {
    fetchMock.mockResolvedValue(tokenResponse());

    expect((await getSession())?.accessToken).toBe("token-1");
  });

  // Normal case: the token is minted against the official Android client id via Basic auth.
  it("authenticates as the Android client", async () => {
    fetchMock.mockResolvedValue(tokenResponse());

    await getSession();

    const [url] = fetchMock.mock.calls[0] as [string];
    const init = initOf(0);

    expect(url).toBe(REDDIT_TOKEN_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe(`Basic ${Buffer.from(`${ANDROID_CLIENT_ID}:`).toString("base64")}`);
    expect(JSON.parse(init.body)).toEqual({ scopes: ["*", "email", "pii"] });
  });

  // Normal case: Reddit expects the app's device headers, and the two device ids must agree.
  it("sends matching Android device headers", async () => {
    fetchMock.mockResolvedValue(tokenResponse());

    await getSession();
    const { headers } = initOf(0);

    expect(headers["User-Agent"]).toMatch(/^Reddit\/Version .+\/Build .+\/Android \d+$/u);
    expect(headers["X-Reddit-Device-Id"]).toBe(headers["client-vendor-id"]);
    expect(headers["x-reddit-compression"]).toBe("1");
    expect(headers["x-reddit-qos"]).toMatch(/^\d+\.\d{3}$/u);
  });

  // Normal case: the loid and session headers identify the device on later calls, so they must be kept.
  it("captures the loid and session response headers", async () => {
    fetchMock.mockResolvedValue(tokenResponse({}, { "x-reddit-loid": LOID, "x-reddit-session": SESSION }));

    const session = await getSession();

    expect(session?.loid).toBe(LOID);
    expect(session?.session).toBe(SESSION);
  });

  // Edge case: those headers are optional, and their absence must not fail the mint.
  it("mints a session even when loid and session are absent", async () => {
    fetchMock.mockResolvedValue(tokenResponse());

    const session = await getSession();

    expect(session?.loid).toBeUndefined();
    expect(session?.session).toBeUndefined();
  });

  // Normal case: a live token is reused rather than re-minted, which is what keeps request volume low.
  it("reuses a live session instead of minting again", async () => {
    fetchMock.mockResolvedValue(tokenResponse());

    const first = await getSession();
    const second = await getSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  // This is the property that prevents the block: one identity per token, not one per request.
  it("keeps the device id and user agent stable for the life of a session", async () => {
    fetchMock.mockResolvedValue(tokenResponse());

    const first = await getSession();
    const second = await getSession();

    expect(second?.deviceId).toBe(first?.deviceId);
    expect(second?.userAgent).toBe(first?.userAgent);
  });

  // Edge case: once the token expires a fresh device identity is minted alongside the new token.
  it("mints a new device identity after the session expires", async () => {
    fetchMock.mockResolvedValue(tokenResponse({ expires_in: 120 }));

    const first = await getSession();
    const second = await getSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second?.deviceId).not.toBe(first?.deviceId);
  });

  // Edge case: an explicit invalidation must force the next call to mint again.
  it("mints again after the session is invalidated", async () => {
    fetchMock.mockResolvedValue(tokenResponse());

    await getSession();
    invalidateSession();
    await getSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Error handling: a refused mint must degrade to undefined so the caller can fall back.
  it("returns undefined on an error status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve("blocked"),
      headers: { get: () => null },
    });

    expect(await getSession()).toBeUndefined();
  });

  // Error handling: a response without a token is unusable and must not become a session.
  it("returns undefined when the token is missing", async () => {
    fetchMock.mockResolvedValue(tokenResponse({ access_token: undefined }));

    expect(await getSession()).toBeUndefined();
  });

  // Error handling: a response without an expiry would cache forever, so it must be rejected.
  it("returns undefined when the expiry is missing", async () => {
    fetchMock.mockResolvedValue(tokenResponse({ expires_in: undefined }));

    expect(await getSession()).toBeUndefined();
  });

  // Error handling: an unreachable host must be caught rather than rejecting into the task.
  it("returns undefined when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await getSession()).toBeUndefined();
  });

  // Error handling: the mint runs under a timeout, and the resulting abort must be swallowed.
  it("returns undefined when the request times out", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));

    expect(await getSession()).toBeUndefined();
  });
});
