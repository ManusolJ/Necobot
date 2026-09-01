import { AI_MODEL_NAME } from "@infrastructure/ai/ollama.constants.js";
import { requestChatCompletion } from "@infrastructure/ai/ollama.client.js";

import type { ChatMessage } from "@shared/types/chat-message.type.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

const MESSAGES: ChatMessage[] = [{ role: "user", content: "Manu: hola" }];

function okResponse(content: unknown): unknown {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ message: { content } }),
    text: () => Promise.resolve(""),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestChatCompletion", () => {
  // Normal case: a well-formed response hands back the model's reply text.
  it("returns the model reply", async () => {
    fetchMock.mockResolvedValue(okResponse("nyaha"));

    expect(await requestChatCompletion(MESSAGES)).toBe("nyaha");
  });

  // Normal case: the request must POST the configured model, the messages, and streaming disabled.
  it("posts the configured model and messages without streaming", async () => {
    fetchMock.mockResolvedValue(okResponse("nyaha"));

    await requestChatCompletion(MESSAGES);

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string; signal: AbortSignal }];
    expect(url).toMatch(/\/api\/chat$/u);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ model: AI_MODEL_NAME, messages: MESSAGES, stream: false });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  // Normal case: reasoning models emit a <think> block that must never reach Discord.
  it("strips a reasoning block from the reply", async () => {
    fetchMock.mockResolvedValue(okResponse("<think>weighing options</think>nyaha"));

    expect(await requestChatCompletion(MESSAGES)).toBe("nyaha");
  });

  // Edge case: reasoning blocks span lines, so the strip has to match across newlines rather than one line.
  it("strips a multi-line reasoning block", async () => {
    fetchMock.mockResolvedValue(okResponse("<think>\nline one\nline two\n</think>\nnyaha"));

    expect(await requestChatCompletion(MESSAGES)).toBe("nyaha");
  });

  // Edge case: several reasoning blocks in one reply must all be removed, not just the first.
  it("strips every reasoning block", async () => {
    fetchMock.mockResolvedValue(okResponse("<think>a</think>hello <think>b</think>world"));

    expect(await requestChatCompletion(MESSAGES)).toBe("hello world");
  });

  // Edge case: surrounding whitespace left by the model or the strip must be trimmed off the reply.
  it("trims surrounding whitespace", async () => {
    fetchMock.mockResolvedValue(okResponse("   nyaha \n"));

    expect(await requestChatCompletion(MESSAGES)).toBe("nyaha");
  });

  // Edge case: a reply that is only reasoning leaves nothing to say, so it must read as no answer at all.
  it("returns undefined when only a reasoning block came back", async () => {
    fetchMock.mockResolvedValue(okResponse("<think>still thinking</think>"));

    expect(await requestChatCompletion(MESSAGES)).toBeUndefined();
  });

  // Edge case: an empty or whitespace-only reply must not be posted as a blank message.
  it("returns undefined for a blank reply", async () => {
    fetchMock.mockResolvedValue(okResponse("   "));

    expect(await requestChatCompletion(MESSAGES)).toBeUndefined();
  });

  // Error handling: a response missing the expected shape must not throw on the optional chain.
  it("returns undefined when the payload has no message", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    });

    expect(await requestChatCompletion(MESSAGES)).toBeUndefined();
  });

  // Error handling: an unloaded model returns a 404, which must degrade to undefined so the listener stays quiet.
  it("returns undefined on an error status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve("model not found"),
    });

    expect(await requestChatCompletion(MESSAGES)).toBeUndefined();
  });

  // Error handling: an unreachable Ollama host must be caught rather than rejecting into the listener.
  it("returns undefined when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await requestChatCompletion(MESSAGES)).toBeUndefined();
  });

  // Error handling: generation can outrun the timeout, and the resulting abort must be swallowed.
  it("returns undefined when the request times out", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));

    expect(await requestChatCompletion(MESSAGES)).toBeUndefined();
  });

  // Error handling: a truncated body fails to parse as JSON, which must not escape the client.
  it("returns undefined when the body is not valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")),
      text: () => Promise.resolve(""),
    });

    expect(await requestChatCompletion(MESSAGES)).toBeUndefined();
  });
});
