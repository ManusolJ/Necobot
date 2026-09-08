import { botCanRewriteMessages } from "@shared/utils/verify-bot-permissions.util.js";

import { uwuifyText } from "@features/uwufier/uwufier.service.js";
import { PROVIDER, UWUFIER_URL } from "@features/uwufier/uwufier.constants.js";

import type { GuildMember, TextChannel } from "discord.js";

import { PermissionFlagsBits } from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

function okResponse(body: unknown): unknown {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uwuifyText", () => {
  // Normal case: the API answers with an `uwu` field, which is the rewritten text.
  it("returns the rewritten text", async () => {
    fetchMock.mockResolvedValue(okResponse({ uwu: "hewwo wowwd" }));

    expect(await uwuifyText("Hello World")).toBe("hewwo wowwd");
  });

  // Normal case: the provider and text have to reach the documented endpoint as a JSON POST.
  it("posts the provider and text to the endpoint", async () => {
    fetchMock.mockResolvedValue(okResponse({ uwu: "hewwo" }));

    await uwuifyText("Hello");

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string; signal: AbortSignal }];
    expect(url).toBe(UWUFIER_URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ provider: PROVIDER, text: "Hello" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  // Edge case: whitespace around the rewrite would post as a padded message.
  it("trims the rewritten text", async () => {
    fetchMock.mockResolvedValue(okResponse({ uwu: "  hewwo  " }));

    expect(await uwuifyText("Hello")).toBe("hewwo");
  });

  // Edge case: an empty rewrite is nothing to post, so the original message is left alone.
  it("returns undefined for a blank rewrite", async () => {
    fetchMock.mockResolvedValue(okResponse({ uwu: "   " }));

    expect(await uwuifyText("Hello")).toBeUndefined();
  });

  // Error handling: a payload without the expected field must not throw on the optional chain.
  it("returns undefined when the payload has no uwu field", async () => {
    fetchMock.mockResolvedValue(okResponse({}));

    expect(await uwuifyText("Hello")).toBeUndefined();
  });

  // Error handling: an API error degrades to leaving the message alone, never to a channel error.
  it("returns undefined on an error status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });

    expect(await uwuifyText("Hello")).toBeUndefined();
  });

  // Error handling: the API is third-party, so an unreachable host must be swallowed.
  it("returns undefined when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("ENOTFOUND"));

    expect(await uwuifyText("Hello")).toBeUndefined();
  });

  // Error handling: a slow API must not hold the listener open past its timeout.
  it("returns undefined when the request times out", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));

    expect(await uwuifyText("Hello")).toBeUndefined();
  });

  // Error handling: a truncated body fails to parse, which must not escape the service.
  it("returns undefined when the body is not valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")),
    });

    expect(await uwuifyText("Hello")).toBeUndefined();
  });
});

describe("uwuifyText preservation", () => {
  /** Echoes back what was sent, with the provider's real l/r substitution applied. */
  function echoUwu(): void {
    fetchMock.mockImplementation((_url: string, init: { body: string }) => {
      const sent = (JSON.parse(init.body) as { text: string }).text;
      return Promise.resolve(okResponse({ uwu: sent.replace(/[lr]/gu, "w") }));
    });
  }

  function sentText(): string {
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    return (JSON.parse(init.body) as { text: string }).text;
  }

  // The reported bug: the provider turns tenor.com into tenow.com and the GIF stops rendering.
  it("keeps a link intact", async () => {
    echoUwu();

    const result = await uwuifyText("look at this https://tenor.com/view/cat-gif-99 haha");

    expect(result).toContain("https://tenor.com/view/cat-gif-99");
    expect(result).not.toContain("tenow.com");
  });

  // The surrounding words still have to be rewritten, or protecting the link would defeat the point.
  it("still rewrites the words around a link", async () => {
    echoUwu();

    const result = await uwuifyText("look at this https://tenor.com/x haha");

    expect(result).toContain("wook");
  });

  // A custom emoji name is letters, so an unprotected one comes back as literal broken text.
  it("keeps a custom emoji intact", async () => {
    echoUwu();

    expect(await uwuifyText("hello <:parrot:123456789> there")).toContain("<:parrot:123456789>");
  });

  // The R in a timestamp is a format specifier the provider lowercases into nonsense.
  it("keeps a timestamp specifier intact", async () => {
    echoUwu();

    expect(await uwuifyText("see you <t:1717171717:R> ok")).toContain("<t:1717171717:R>");
  });

  // Mentions are digits so they survive anyway, but they must not be corrupted by the masking either.
  it("keeps mentions intact", async () => {
    echoUwu();

    const result = await uwuifyText("hello <@123> and <#456> and <@&789> ok");

    expect(result).toContain("<@123>");
    expect(result).toContain("<#456>");
    expect(result).toContain("<@&789>");
  });

  // Code is quoted verbatim by definition, and often contains exactly the characters being rewritten.
  it("keeps inline code and fenced blocks intact", async () => {
    echoUwu();

    const result = await uwuifyText("try `npm run lint` or ```rm -rf all``` ok");

    expect(result).toContain("`npm run lint`");
    expect(result).toContain("```rm -rf all```");
  });

  // Several protected spans in one message must each come back in their original position.
  it("restores several spans in order", async () => {
    echoUwu();

    const result = await uwuifyText("a https://one.com b https://two.com c");

    expect(result).toBe("a https://one.com b https://two.com c");
  });

  // The masked payload is what goes over the wire, so the protected spans never reach the provider.
  it("sends placeholders rather than the protected spans", async () => {
    echoUwu();

    await uwuifyText("look https://tenor.com/x");

    expect(sentText()).not.toContain("tenor.com");
    expect(sentText()).toContain("{{0}}");
  });

  // A bare GIF post has no words to rewrite, so it is left alone instead of being reposted unchanged.
  it("leaves a message that is only a link alone", async () => {
    echoUwu();

    expect(await uwuifyText("https://tenor.com/view/cat-gif-99")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Edge case: an emoji-only message is the same situation and must not burn a paid message either.
  it("leaves a message that is only an emoji alone", async () => {
    echoUwu();

    expect(await uwuifyText("<:parrot:123456789>")).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Safety net: if the provider ever mangles a placeholder, posting a half-restored message is worse
  // than posting nothing.
  it("returns undefined when the provider drops a placeholder", async () => {
    fetchMock.mockResolvedValue(okResponse({ uwu: "wook at this  haha" }));

    expect(await uwuifyText("look at this https://tenor.com/x haha")).toBeUndefined();
  });

  // Edge case: a URL containing $& must not be read as a regex substitution while being restored.
  it("restores a url containing substitution characters", async () => {
    echoUwu();

    const result = await uwuifyText("see https://example.com/a?b=$&c=1 ok");

    expect(result).toContain("https://example.com/a?b=$&c=1");
  });
});

describe("botCanRewriteMessages", () => {
  function channelAllowing(...allowed: bigint[]): TextChannel {
    return {
      permissionsFor: () => ({ has: (needed: bigint[]) => needed.every((flag) => allowed.includes(flag)) }),
    } as unknown as TextChannel;
  }

  const bot = {} as GuildMember;

  const ALL = [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.SendMessages,
  ];

  // Normal case: a rewrite needs to delete, to post through a webhook, and to speak in the channel.
  it("allows a bot holding every required permission", () => {
    expect(botCanRewriteMessages(bot, channelAllowing(...ALL))).toBe(true);
  });

  // Edge case: each permission is individually required, so dropping any one has to fail closed.
  it.each([
    ["ManageMessages", PermissionFlagsBits.ManageMessages],
    ["ManageWebhooks", PermissionFlagsBits.ManageWebhooks],
    ["SendMessages", PermissionFlagsBits.SendMessages],
  ])("refuses when %s is missing", (_label, missing) => {
    const remaining = ALL.filter((flag) => flag !== missing);

    expect(botCanRewriteMessages(bot, channelAllowing(...remaining))).toBe(false);
  });

  // Edge case: an unresolved bot member counts as "cannot", matching the other guards in this file.
  it("refuses when the bot member is unresolved", () => {
    expect(botCanRewriteMessages(undefined, channelAllowing(...ALL))).toBe(false);
  });
});
