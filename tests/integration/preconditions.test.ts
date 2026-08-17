import { completeGuildSetup } from "@core/services/guild.service.js";
import { setUserExclusion, sumPointsToUser } from "@core/services/user.service.js";

import { NotExcludedPrecondition } from "@shared/preconditions/not-excluded.precondition.js";
import { GuildConfiguredPrecondition } from "@shared/preconditions/guild-configured.precondition.js";

import { resetDatabase, seedGuild, useMigratedDatabase } from "../helpers/database.js";

import type { ChatInputCommandInteraction } from "discord.js";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const GUILD = "guild-1";
const USER = "user-1";

function stubInteraction(guildId: string | null, userId = USER): ChatInputCommandInteraction {
  return {
    guildId,
    user: { id: userId },
    inGuild: () => guildId !== null,
  } as unknown as ChatInputCommandInteraction;
}

function build<T>(Ctor: new (context: never, options: never) => T, name: string): T {
  const context = { store: { name: "preconditions" }, path: `${name}.ts`, name, root: process.cwd() };
  return new Ctor(context as never, {} as never);
}

beforeAll(() => {
  useMigratedDatabase();
});

beforeEach(() => {
  resetDatabase();
});

describe("GuildConfigured", () => {
  const precondition = build(GuildConfiguredPrecondition, "GuildConfigured");

  it("rejects a direct message", async () => {
    const result = await precondition.chatInputRun(stubInteraction(null));
    expect(result.isErr()).toBe(true);
  });

  it("rejects a guild that has never run /settings", async () => {
    const result = await precondition.chatInputRun(stubInteraction(GUILD));
    expect(result.isErr()).toBe(true);
  });

  it("rejects a guild row that exists but never completed setup", async () => {
    seedGuild(GUILD);

    const result = await precondition.chatInputRun(stubInteraction(GUILD));
    expect(result.isErr()).toBe(true);
  });

  it("accepts a configured guild", async () => {
    completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });

    const result = await precondition.chatInputRun(stubInteraction(GUILD));
    expect(result.isOk()).toBe(true);
  });
});

describe("NotExcluded", () => {
  const precondition = build(NotExcludedPrecondition, "NotExcluded");

  beforeEach(() => {
    seedGuild(GUILD);
  });

  it("accepts a user with no record", async () => {
    const result = await precondition.chatInputRun(stubInteraction(GUILD));
    expect(result.isOk()).toBe(true);
  });

  it("accepts a known but unexcluded user", async () => {
    sumPointsToUser(GUILD, USER, 10);

    const result = await precondition.chatInputRun(stubInteraction(GUILD));
    expect(result.isOk()).toBe(true);
  });

  it("rejects an excluded user", async () => {
    setUserExclusion(GUILD, USER, true);

    const result = await precondition.chatInputRun(stubInteraction(GUILD));
    expect(result.isErr()).toBe(true);
  });

  it("accepts again after readmission", async () => {
    setUserExclusion(GUILD, USER, true);
    setUserExclusion(GUILD, USER, false);

    const result = await precondition.chatInputRun(stubInteraction(GUILD));
    expect(result.isOk()).toBe(true);
  });

  it("only excludes within the guild it was applied to", async () => {
    seedGuild("guild-2");
    setUserExclusion(GUILD, USER, true);

    const result = await precondition.chatInputRun(stubInteraction("guild-2"));
    expect(result.isOk()).toBe(true);
  });
});
