import { ImageTooLargeError, InvalidImageAttachmentError } from "@infrastructure/errors/domain.errors.js";

import { assertSupportedImage, downloadImage } from "@features/vision/image-attachment.util.js";
import { VISION_IMAGE_MAX_BYTES, VISION_IMAGE_MIME_TYPES } from "@features/vision/vision.constants.js";

import type { Attachment } from "discord.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: "attachment-1",
    url: "https://cdn.example/monster.png",
    name: "monster.png",
    contentType: "image/png",
    size: 1024,
    ...overrides,
  } as Attachment;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assertSupportedImage", () => {
  // Normal case: every MIME type the vision pipeline declares support for must pass the guard.
  it.each(VISION_IMAGE_MIME_TYPES)("accepts %s", (contentType) => {
    expect(() => {
      assertSupportedImage(attachment({ contentType }));
    }).not.toThrow();
  });

  // Edge case: Discord appends parameters like "; charset=utf-8", which must be stripped before the lookup.
  it("ignores parameters after the MIME type", () => {
    expect(() => {
      assertSupportedImage(attachment({ contentType: "image/png; charset=utf-8" }));
    }).not.toThrow();
  });

  // Edge case: surrounding whitespace in the header must not turn a supported type into a rejection.
  it("trims whitespace around the MIME type", () => {
    expect(() => {
      assertSupportedImage(attachment({ contentType: " image/jpeg " }));
    }).not.toThrow();
  });

  // Error handling: an unsupported image format is rejected before any download is attempted.
  it("rejects an unsupported image type", () => {
    expect(() => {
      assertSupportedImage(attachment({ contentType: "image/gif" }));
    }).toThrow(InvalidImageAttachmentError);
  });

  // Error handling: a non-image upload must be refused rather than handed to the classifier.
  it("rejects a non-image attachment", () => {
    expect(() => {
      assertSupportedImage(attachment({ contentType: "application/pdf" }));
    }).toThrow(InvalidImageAttachmentError);
  });

  // Edge case: Discord can omit the content type entirely, which must fail closed as an empty string.
  it("rejects an attachment with no content type", () => {
    expect(() => {
      assertSupportedImage(attachment({ contentType: null }));
    }).toThrow(InvalidImageAttachmentError);
  });

  // Error handling: the rejection carries the id and resolved type so the failure can be traced to an upload.
  it("reports the attachment id and resolved type", () => {
    expect(() => {
      assertSupportedImage(attachment({ contentType: "image/gif" }));
    }).toThrow(
      expect.objectContaining({
        code: "invalid_image_attachment",
        context: { attachmentId: "attachment-1", contentType: "image/gif" },
      }),
    );
  });

  // Edge case: the size limit is inclusive, so an image sitting exactly on the cap is still accepted.
  it("accepts an image exactly at the size limit", () => {
    expect(() => {
      assertSupportedImage(attachment({ size: VISION_IMAGE_MAX_BYTES }));
    }).not.toThrow();
  });

  // Edge case: one byte over the cap is the first rejection, which pins the boundary against off-by-one drift.
  it("rejects an image one byte over the limit", () => {
    expect(() => {
      assertSupportedImage(attachment({ size: VISION_IMAGE_MAX_BYTES + 1 }));
    }).toThrow(ImageTooLargeError);
  });

  // Error handling: the type check runs first, so a file that is both wrong-typed and oversized fails on its type.
  it("reports the type problem before the size problem", () => {
    expect(() => {
      assertSupportedImage(attachment({ contentType: "video/mp4", size: VISION_IMAGE_MAX_BYTES * 2 }));
    }).toThrow(InvalidImageAttachmentError);
  });
});

describe("downloadImage", () => {
  // Normal case: a successful response yields the blob the classifier consumes.
  it("returns the blob on a successful response", async () => {
    const blob = new Blob(["image-bytes"]);
    fetchMock.mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob) });

    expect(await downloadImage(attachment())).toBe(blob);
  });

  // Normal case: the download must target the attachment URL and carry a timeout signal so it cannot hang.
  it("requests the attachment url with a timeout signal", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(new Blob()) });

    await downloadImage(attachment({ url: "https://cdn.example/cat.png" }));

    const [url, init] = fetchMock.mock.calls[0] as [string, { signal: AbortSignal }];
    expect(url).toBe("https://cdn.example/cat.png");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  // Error handling: an expired CDN link returns 404, which must degrade to undefined rather than throw.
  it("returns undefined when the CDN responds with an error status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, blob: () => Promise.resolve(new Blob()) });

    expect(await downloadImage(attachment())).toBeUndefined();
  });

  // Error handling: a server-side failure is treated the same way, letting the command fall back to a canned reply.
  it("returns undefined on a server error status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, blob: () => Promise.resolve(new Blob()) });

    expect(await downloadImage(attachment())).toBeUndefined();
  });

  // Error handling: a network failure must be caught so the command never rejects on a transport problem.
  it("returns undefined when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    expect(await downloadImage(attachment())).toBeUndefined();
  });

  // Error handling: a timeout surfaces as an abort, which must be swallowed like any other transport error.
  it("returns undefined when the request times out", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));

    expect(await downloadImage(attachment())).toBeUndefined();
  });

  // Error handling: the body can fail after a 200, so a rejecting blob() must not escape as an unhandled rejection.
  it("returns undefined when reading the body fails", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, blob: () => Promise.reject(new Error("stream closed")) });

    expect(await downloadImage(attachment())).toBeUndefined();
  });
});
