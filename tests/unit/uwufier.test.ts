import { botCanRewriteMessages } from "@shared/utils/verify-bot-permissions.util.js";

import { splitPreserved, uwuifyText } from "@features/uwufier/uwufier.service.js";

import type { GuildMember, TextChannel } from "discord.js";

import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";

describe("uwuifyText", () => {
  // Normal case: prose gets the w/ny treatment. The library is seeded per word, so this is stable.
  it("rewrites plain prose", () => {
    const result = uwuifyText("hola, mira la libreria");

    expect(result).toBeDefined();
    expect(result).not.toBe("hola, mira la libreria");
    expect(result).toMatch(/w/u);
  });

  it("is deterministic for the same input", () => {
    expect(uwuifyText("hola que tal estas hoy")).toBe(uwuifyText("hola que tal estas hoy"));
  });

  // Edge case: surrounding whitespace would post as a padded message.
  it("trims the result", () => {
    const result = uwuifyText("  hola que tal  ");

    expect(result).toBe(result?.trim());
  });

  // Edge case: nothing with letters means nothing to rewrite, so the message is left alone.
  it.each(["", "   ", "123 456", "!!! ???", "🐱🐱"])("returns undefined for %j", (input) => {
    expect(uwuifyText(input)).toBeUndefined();
  });
});

describe("splitPreserved", () => {
  it("alternates prose and preserved spans in order", () => {
    expect(splitPreserved("a https://one.com b <@123> c")).toEqual([
      { text: "a ", preserved: false },
      { text: "https://one.com", preserved: true },
      { text: " b ", preserved: false },
      { text: "<@123>", preserved: true },
      { text: " c", preserved: false },
    ]);
  });

  it("returns a single prose segment when nothing is preserved", () => {
    expect(splitPreserved("hola")).toEqual([{ text: "hola", preserved: false }]);
  });

  it("returns a single preserved segment for a bare link", () => {
    expect(splitPreserved("https://tenor.com/x")).toEqual([{ text: "https://tenor.com/x", preserved: true }]);
  });
});

describe("uwuifyText preservation", () => {
  // The reported bug: the rewrite turned tenor.com into tenow.com and the GIF stopped rendering.
  it("keeps a link intact", () => {
    const result = uwuifyText("look at this https://tenor.com/view/cat-gif-99 haha");

    expect(result).toContain("https://tenor.com/view/cat-gif-99");
    expect(result).not.toContain("tenow.com");
  });

  // The surrounding words still have to be rewritten, or protecting the link would defeat the point.
  it("still rewrites the words around a link", () => {
    expect(uwuifyText("look at this https://tenor.com/x haha")).toContain("wook");
  });

  // A custom emoji name is letters, so an unprotected one comes back as literal broken text.
  it("keeps a custom emoji intact", () => {
    expect(uwuifyText("hello <:parrot:123456789> there")).toContain("<:parrot:123456789>");
  });

  // The R in a timestamp is a format specifier that would be rewritten into nonsense.
  it("keeps a timestamp specifier intact", () => {
    expect(uwuifyText("see you <t:1717171717:R> ok")).toContain("<t:1717171717:R>");
  });

  // Mentions are digits so they would survive anyway, but they must not be corrupted by the splitting either.
  it("keeps mentions intact", () => {
    const result = uwuifyText("hello <@123> and <#456> and <@&789> ok");

    expect(result).toContain("<@123>");
    expect(result).toContain("<#456>");
    expect(result).toContain("<@&789>");
  });

  // Code is quoted verbatim by definition, and often contains exactly the characters being rewritten.
  // The library on its own would stutter on the opening backtick (`-`-`const`), so code must never reach it.
  it("keeps inline code and fenced blocks intact", () => {
    const result = uwuifyText("try `npm run lint` or ```rm -rf all``` ok");

    expect(result).toContain("`npm run lint`");
    expect(result).toContain("```rm -rf all```");
  });

  // Several protected spans in one message must each come back in their original position.
  it("keeps several spans in order", () => {
    const result = uwuifyText("primero https://one.com luego https://two.com final") ?? "";

    expect(result.match(/https:\/\/\S+/gu)).toEqual(["https://one.com", "https://two.com"]);
    expect(result.indexOf("https://one.com")).toBeLessThan(result.indexOf("https://two.com"));
  });

  // A bare GIF post has no words to rewrite, so it is left alone instead of being reposted unchanged.
  it("leaves a message that is only a link alone", () => {
    expect(uwuifyText("https://tenor.com/view/cat-gif-99")).toBeUndefined();
  });

  // Edge case: an emoji-only message is the same situation and must not burn a paid message either.
  it("leaves a message that is only an emoji alone", () => {
    expect(uwuifyText("<:parrot:123456789>")).toBeUndefined();
  });

  // Edge case: a URL containing $& must not be read as a regex substitution while being reassembled.
  it("keeps a url containing substitution characters", () => {
    expect(uwuifyText("see https://example.com/a?b=$&c=1 ok")).toContain("https://example.com/a?b=$&c=1");
  });

  // Edge case: prose that starts or ends right at a preserved span has no padding for the library to trip on.
  it("handles prose glued to preserved spans", () => {
    const result = uwuifyText("hola<@123>mundo");

    expect(result).toContain("<@123>");
    expect(result?.startsWith("<@123>")).toBe(false);
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
