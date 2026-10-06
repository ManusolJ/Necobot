import { fetchWorkSummary } from "@infrastructure/wikipedia/wikipedia.client.js";
import { WIKIMEDIA_USER_AGENT } from "@infrastructure/wikipedia/wikipedia.constants.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

function okResponse(payload: unknown): unknown {
  return { ok: true, status: 200, json: () => Promise.resolve(payload) };
}

const SEARCH_HIT = okResponse({ query: { search: [{ title: "Q1755351" }] } });
const SITELINK = okResponse({ entities: { Q1755351: { sitelinks: { frwiki: { title: "Marelle (roman)" } } } } });
const SUMMARY = okResponse({
  type: "standard",
  title: "Marelle (roman)",
  extract: "Marelle est un roman de l'écrivain argentin Julio Cortázar.",
  thumbnail: { source: "https://upload.wikimedia.org/marelle.png" },
  content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Marelle_(roman)" } },
});

function requestedUrl(call: number): string {
  return fetchMock.mock.calls[call]?.[0] as string;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWorkSummary", () => {
  // Normal case: the work is found on Wikidata, followed to the requested language's article, and summarised.
  it("returns the summary of the book's article in the requested language", async () => {
    fetchMock.mockResolvedValueOnce(SEARCH_HIT).mockResolvedValueOnce(SITELINK).mockResolvedValueOnce(SUMMARY);

    expect(await fetchWorkSummary("Rayuela", "Julio Cortázar", "fr")).toEqual({
      title: "Marelle (roman)",
      extract: "Marelle est un roman de l'écrivain argentin Julio Cortázar.",
      language: "fr",
      url: "https://fr.wikipedia.org/wiki/Marelle_(roman)",
      thumbnail: "https://upload.wikimedia.org/marelle.png",
    });
    expect(requestedUrl(2)).toBe("https://fr.wikipedia.org/api/rest_v1/page/summary/Marelle_(roman)");
  });

  // Normal case: the search is limited to written works and narrowed by the author's surname, which is what
  // keeps the author's own article and the film adaptation out.
  it("searches Wikidata for written works with the author's surname", async () => {
    fetchMock.mockResolvedValueOnce(SEARCH_HIT).mockResolvedValueOnce(SITELINK).mockResolvedValueOnce(SUMMARY);

    await fetchWorkSummary("Rayuela", "Julio Cortázar", "fr");

    const search = new URL(requestedUrl(0)).searchParams.get("srsearch");
    expect(search).toMatch(/^Rayuela Cortázar haswbstatement:P31=Q7725634\|/u);
    expect(new URL(requestedUrl(1)).searchParams.get("sitefilter")).toBe("frwiki");
  });

  // Safety: Wikimedia blocks anonymous clients, so every request must identify the bot.
  it("identifies the bot in the user agent", async () => {
    fetchMock.mockResolvedValueOnce(SEARCH_HIT).mockResolvedValueOnce(SITELINK).mockResolvedValueOnce(SUMMARY);

    await fetchWorkSummary("Rayuela", undefined, "fr");

    for (const [, init] of fetchMock.mock.calls as [string, { headers: Record<string, string> }][]) {
      expect(init.headers["User-Agent"]).toBe(WIKIMEDIA_USER_AGENT);
    }
  });

  // Edge case: no written work by that name means no summary, without asking for sitelinks.
  it("returns undefined when Wikidata has no matching work", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ query: { search: [] } }));

    expect(await fetchWorkSummary("asdkjhqwe", undefined, "es")).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Edge case: plenty of books have no article in the user's language.
  it("returns undefined when the work has no article in that language", async () => {
    fetchMock.mockResolvedValueOnce(SEARCH_HIT).mockResolvedValueOnce(okResponse({ entities: { Q1755351: {} } }));

    expect(await fetchWorkSummary("Rayuela", "Julio Cortázar", "fr")).toBeUndefined();
  });

  // Edge case: a disambiguation page lists meanings instead of describing the book.
  it("returns undefined for anything but a standard article", async () => {
    fetchMock
      .mockResolvedValueOnce(SEARCH_HIT)
      .mockResolvedValueOnce(SITELINK)
      .mockResolvedValueOnce(okResponse({ type: "disambiguation", extract: "Marelle puede referirse a:" }));

    expect(await fetchWorkSummary("Rayuela", "Julio Cortázar", "fr")).toBeUndefined();
  });

  // Safety: the language becomes a hostname, so anything that is not a plain language code is refused outright.
  it("refuses a language that is not a plain language code", async () => {
    expect(await fetchWorkSummary("Rayuela", undefined, "evil.example/x")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Error handling: a failed request reads as "no summary" so the caller can fall back.
  it("returns undefined on an error status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });

    expect(await fetchWorkSummary("Rayuela", undefined, "es")).toBeUndefined();
  });

  // Error handling: network errors and timeouts must not reject into the command.
  it("returns undefined when a request throws", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    expect(await fetchWorkSummary("Rayuela", undefined, "es")).toBeUndefined();
  });
});
