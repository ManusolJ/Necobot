import {
  armMines,
  restoreMine,
  tryConsumeMine,
  getGuildChannel,
  getGuildSettings,
  completeGuildSetup,
  registerGuildChannel,
} from "@core/services/guild.service.js";

import { resetDatabase, useMigratedDatabase } from "../helpers/database.js";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const GUILD = "guild-1";

beforeAll(() => {
  useMigratedDatabase();
});

beforeEach(() => {
  resetDatabase();
});

describe("completeGuildSetup", () => {
  it("creates settings on first run and marks setup complete", () => {
    const saved = completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a", prefix: "?" });

    expect(saved.mainChannelId).toBe("chan-a");
    expect(saved.prefix).toBe("?");
    expect(saved.setupCompletedAt).not.toBeNull();
  });

  it("defaults the prefix from the schema when none is given", () => {
    expect(completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" }).prefix).toBe("!");
  });

  it("preserves stored options that the re-run did not supply", () => {
    completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a", prefix: "?", begRetryRoleId: "role-9" });

    const updated = completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-b" });

    expect(updated.prefix).toBe("?");
    expect(updated.begRetryRoleId).toBe("role-9");
  });

  it("still applies the options that were supplied", () => {
    completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a", prefix: "?" });

    const updated = completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-b", prefix: "$" });

    expect(updated.mainChannelId).toBe("chan-b");
    expect(updated.prefix).toBe("$");
  });

  it("does not disturb the active mine count", () => {
    completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });
    armMines(GUILD, 4);

    expect(completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-b" }).activeMines).toBe(4);
  });
});

describe("mine accounting", () => {
  beforeEach(() => {
    completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });
  });

  it("arms and consumes mines", () => {
    expect(armMines(GUILD, 2).activeMines).toBe(2);
    expect(tryConsumeMine(GUILD)).toBe(true);
    expect(getGuildSettings(GUILD)?.activeMines).toBe(1);
  });

  it("refuses to consume below zero", () => {
    expect(tryConsumeMine(GUILD)).toBe(false);
    expect(getGuildSettings(GUILD)?.activeMines).toBe(0);
  });

  it("puts a mine back when a detonation could not be delivered", () => {
    armMines(GUILD, 1);
    tryConsumeMine(GUILD);
    restoreMine(GUILD);

    expect(getGuildSettings(GUILD)?.activeMines).toBe(1);
  });
});

describe("guild channels", () => {
  beforeEach(() => {
    completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });
  });

  it("stores and reads back a channel by purpose", () => {
    registerGuildChannel({ guildId: GUILD, purpose: "archive", channelId: "chan-z" });

    expect(getGuildChannel(GUILD, "archive")?.channelId).toBe("chan-z");
  });

  it("returns undefined for a purpose the guild never registered", () => {
    expect(getGuildChannel(GUILD, "archive")).toBeUndefined();
  });

  it("replaces the channel when the same purpose is registered again", () => {
    registerGuildChannel({ guildId: GUILD, purpose: "archive", channelId: "chan-y" });
    registerGuildChannel({ guildId: GUILD, purpose: "archive", channelId: "chan-z" });

    expect(getGuildChannel(GUILD, "archive")?.channelId).toBe("chan-z");
  });

  it("does not leak channels across guilds", () => {
    completeGuildSetup({ guildId: "guild-2", mainChannelId: "chan-b" });
    registerGuildChannel({ guildId: "guild-2", purpose: "archive", channelId: "chan-other" });

    expect(getGuildChannel(GUILD, "archive")).toBeUndefined();
  });
});
