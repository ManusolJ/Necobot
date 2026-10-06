import { searchVolumes } from "@infrastructure/books/google-books.client.js";
import { GOOGLE_BOOKS_ATTEMPTS, GOOGLE_BOOKS_RETRY_DELAY_MS } from "@infrastructure/books/google-books.constants.js";

import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn() }));

const fetchMock = vi.fn();

const RAW_VOLUME = {
  id: "S1TKEAAAQBAJ",
  volumeInfo: {
    title: "Rayuela",
    authors: ["Julio Cortázar"],
    publisher: "ALFAGUARA",
    publishedDate: "2023-08-01",
    description: "Un verdadero artefacto literario.",
    pageCount: 554,
    categories: ["Fiction"],
    language: "es",
    infoLink: "http://books.google.es/books?id=S1TKEAAAQBAJ&source=gbs_api",
    imageLinks: { thumbnail: "http://books.google.com/books/content?id=S1TKEAAAQBAJ&zoom=1&edge=curl&source=gbs_api" },
    industryIdentifiers: [
      { type: "ISBN_10", identifier: "8420471836" },
      { type: "ISBN_13", identifier: "9788420471839" },
    ],
  },
};

function okResponse(payload: unknown): unknown {
  return { ok: true, status: 200, json: () => Promise.resolve(payload), text: () => Promise.resolve("") };
}

function errorResponse(status: number): unknown {
  return { ok: false, status, json: () => Promise.resolve({}), text: () => Promise.resolve("unavailable") };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(sleep).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchVolumes", () => {
  // Normal case: a raw volume is flattened into the fields the command shows, with Discord-safe links.
  it("maps a volume into the shape the feature uses", async () => {
    fetchMock.mockResolvedValue(okResponse({ items: [RAW_VOLUME] }));

    expect(await searchVolumes("rayuela")).toEqual([
      {
        id: "S1TKEAAAQBAJ",
        title: "Rayuela",
        subtitle: undefined,
        authors: ["Julio Cortázar"],
        publisher: "ALFAGUARA",
        publishedDate: "2023-08-01",
        description: "Un verdadero artefacto literario.",
        pageCount: 554,
        categories: ["Fiction"],
        averageRating: undefined,
        ratingsCount: undefined,
        language: "es",
        isbn: "9788420471839",
        thumbnail: "https://books.google.com/books/content?id=S1TKEAAAQBAJ&zoom=1&source=gbs_api",
        link: "https://books.google.es/books?id=S1TKEAAAQBAJ&source=gbs_api",
      },
    ]);
  });

  // Safety: the key travels in a header so it never ends up in a logged or cached URL.
  it("sends the API key as a header and keeps it out of the URL", async () => {
    fetchMock.mockResolvedValue(okResponse({ items: [] }));

    await searchVolumes("cien años de soledad");

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-google-books-key");
    expect(url).not.toContain("test-google-books-key");

    const params = new URL(url).searchParams;
    expect(params.get("q")).toBe("cien años de soledad");
    expect(params.get("printType")).toBe("books");
    expect(params.get("fields")).toContain("volumeInfo(");
  });

  // Edge case: older editions only carry an ISBN-10, which is still worth showing.
  it("falls back to the ISBN-10 when there is no ISBN-13", async () => {
    const identifiers = [{ type: "ISBN_10", identifier: "8420471836" }];
    fetchMock.mockResolvedValue(
      okResponse({
        items: [{ ...RAW_VOLUME, volumeInfo: { ...RAW_VOLUME.volumeInfo, industryIdentifiers: identifiers } }],
      }),
    );

    expect((await searchVolumes("rayuela"))?.[0]?.isbn).toBe("8420471836");
  });

  // Edge case: publisher blurbs sometimes leak HTML, which Discord would print literally.
  it("strips HTML from descriptions", async () => {
    const description = "<p><b>Rayuela</b> es una novela.</p><p>Tiene dos lecturas.</p>";
    fetchMock.mockResolvedValue(
      okResponse({ items: [{ ...RAW_VOLUME, volumeInfo: { ...RAW_VOLUME.volumeInfo, description } }] }),
    );

    expect((await searchVolumes("rayuela"))?.[0]?.description).toBe("Rayuela es una novela.\nTiene dos lecturas.");
  });

  // Edge case: entries without an id or title cannot be shown or linked, so they are dropped.
  it("skips volumes missing an id or a title", async () => {
    fetchMock.mockResolvedValue(
      okResponse({ items: [{ volumeInfo: { title: "Sin id" } }, { id: "x", volumeInfo: {} }] }),
    );

    expect(await searchVolumes("rayuela")).toEqual([]);
  });

  // Edge case: Google omits `items` entirely when nothing matches, which must read as "no results", not failure.
  it("returns an empty list when nothing matches", async () => {
    fetchMock.mockResolvedValue(okResponse({}));

    expect(await searchVolumes("asdkjhqwe")).toEqual([]);
  });

  // Error handling: Google's 503s come and go, so a server error is retried with a growing pause.
  it("retries server errors and returns the first successful answer", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse({ items: [RAW_VOLUME] }));

    expect(await searchVolumes("rayuela")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.mocked(sleep).mock.calls).toEqual([[GOOGLE_BOOKS_RETRY_DELAY_MS], [GOOGLE_BOOKS_RETRY_DELAY_MS * 2]]);
  });

  // Error handling: after the last attempt the caller must be told the service is unavailable.
  it("returns undefined once every attempt failed", async () => {
    fetchMock.mockResolvedValue(errorResponse(503));

    expect(await searchVolumes("rayuela")).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(GOOGLE_BOOKS_ATTEMPTS);
  });

  // Error handling: a spent quota or a bad key will not fix itself, so it is not retried.
  it("does not retry client errors", async () => {
    fetchMock.mockResolvedValue(errorResponse(429));

    expect(await searchVolumes("rayuela")).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Error handling: a dropped connection is as transient as a 503.
  it("retries when the request throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(okResponse({ items: [RAW_VOLUME] }));

    expect(await searchVolumes("rayuela")).toHaveLength(1);
  });

  // Error handling: a timeout already cost the full budget, so it is not retried on top.
  it("does not retry a timeout", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));

    expect(await searchVolumes("rayuela")).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Error handling: a truncated body must not escape the client as a JSON error.
  it("returns undefined when the body is not valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")),
      text: () => Promise.resolve(""),
    });

    expect(await searchVolumes("rayuela")).toBeUndefined();
  });
});
