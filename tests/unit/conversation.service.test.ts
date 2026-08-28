import { AI_HISTORY_TTL_MS, AI_HISTORY_MAX_MESSAGES } from "@features/conversation/conversation.constants.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestChatCompletion = vi.hoisted(() => vi.fn());

vi.mock("@infrastructure/ai/ollama.client.js", () => ({
  requestChatCompletion,
  isOllamaConfigured: () => true,
}));

const { generateChatReply } = await import("@features/conversation/conversation.service.js");

let CHANNEL = "";
let channelCounter = 0;

function promptAt(call: number): { role: string; content: string }[] {
  return requestChatCompletion.mock.calls[call]?.[0] as { role: string; content: string }[];
}

beforeEach(() => {
  channelCounter += 1;
  CHANNEL = `channel-${String(channelCounter)}`;
  requestChatCompletion.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateChatReply", () => {
  it("sends the author name alongside the text", async () => {
    requestChatCompletion.mockResolvedValue("nyaha");

    await generateChatReply(CHANNEL, "Manu", "hola");

    expect(promptAt(0)).toEqual([{ role: "user", content: "Manu: hola" }]);
  });

  it("carries prior turns into the next prompt", async () => {
    requestChatCompletion.mockResolvedValue("first reply");
    await generateChatReply(CHANNEL, "Manu", "one");

    requestChatCompletion.mockResolvedValue("second reply");
    await generateChatReply(CHANNEL, "Manu", "two");

    expect(promptAt(1)).toEqual([
      { role: "user", content: "Manu: one" },
      { role: "assistant", content: "first reply" },
      { role: "user", content: "Manu: two" },
    ]);
  });

  it("keeps channels separate", async () => {
    requestChatCompletion.mockResolvedValue("reply");
    await generateChatReply(CHANNEL, "Manu", "one");
    await generateChatReply(`${CHANNEL}-other`, "Otro", "two");

    expect(promptAt(1)).toEqual([{ role: "user", content: "Otro: two" }]);
  });

  it("does not record a turn the model failed to answer", async () => {
    requestChatCompletion.mockResolvedValue(undefined);
    expect(await generateChatReply(CHANNEL, "Manu", "one")).toBeUndefined();

    requestChatCompletion.mockResolvedValue("reply");
    await generateChatReply(CHANNEL, "Manu", "two");

    expect(promptAt(1)).toEqual([{ role: "user", content: "Manu: two" }]);
  });

  it("caps retained history", async () => {
    requestChatCompletion.mockResolvedValue("reply");

    for (let i = 0; i < AI_HISTORY_MAX_MESSAGES; i += 1) {
      await generateChatReply(CHANNEL, "Manu", `message ${String(i)}`);
    }

    const lastPrompt = promptAt(AI_HISTORY_MAX_MESSAGES - 1);
    expect(lastPrompt.length).toBeLessThanOrEqual(AI_HISTORY_MAX_MESSAGES + 1);
  });

  it("forgets a channel once its history has gone stale", async () => {
    requestChatCompletion.mockResolvedValue("reply");
    await generateChatReply(CHANNEL, "Manu", "one");

    vi.advanceTimersByTime(AI_HISTORY_TTL_MS + 1);
    await generateChatReply(CHANNEL, "Manu", "two");

    expect(promptAt(1)).toEqual([{ role: "user", content: "Manu: two" }]);
  });

  it("keeps history that is still within the window", async () => {
    requestChatCompletion.mockResolvedValue("reply");
    await generateChatReply(CHANNEL, "Manu", "one");

    vi.advanceTimersByTime(AI_HISTORY_TTL_MS - 1000);
    await generateChatReply(CHANNEL, "Manu", "two");

    expect(promptAt(1)).toHaveLength(3);
  });
});
