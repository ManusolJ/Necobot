import {
  armMines,
  restoreMine,
  getGuildState,
  tryConsumeMine,
  getGuildChannel,
  completeGuildSetup,
  registerGuildChannel,
} from "@core/services/guild.service.js";

import { resetDatabase, useMigratedDatabase } from "../helpers/database.js";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const GUILD = "guild-1";

beforeAll(async () => {
  await useMigratedDatabase();
});

beforeEach(async () => {
  await resetDatabase();
});

describe("completeGuildSetup", () => {
  it("creates settings on first run and marks setup complete", async () => {
    const saved = await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a", specialRoleId: "role-1" });

    expect(saved.mainChannelId).toBe("chan-a");
    expect(saved.specialRoleId).toBe("role-1");
    expect(saved.setupCompletedAt).not.toBeNull();
  });

  // Settings and state live in separate tables; setup must leave both, or the mines have nowhere to go.
  it("creates the guild's state row with no mines armed", async () => {
    await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });

    expect((await getGuildState(GUILD))?.activeMines).toBe(0);
  });

  it("preserves stored options that the re-run did not supply", async () => {
    await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a", specialRoleId: "role-9" });

    const updated = await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-b" });

    expect(updated.specialRoleId).toBe("role-9");
  });

  it("still applies the options that were supplied", async () => {
    await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a", specialRoleId: "role-1" });

    const updated = await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-b", specialRoleId: "role-2" });

    expect(updated.mainChannelId).toBe("chan-b");
    expect(updated.specialRoleId).toBe("role-2");
  });

  it("does not disturb the active mine count", async () => {
    await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });
    await armMines(GUILD, 4);
    await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-b" });

    expect((await getGuildState(GUILD))?.activeMines).toBe(4);
  });
});

describe("mine accounting", () => {
  beforeEach(async () => {
    await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });
  });

  it("arms and consumes mines", async () => {
    expect((await armMines(GUILD, 2)).activeMines).toBe(2);
    expect(await tryConsumeMine(GUILD)).toBe(true);
    expect((await getGuildState(GUILD))?.activeMines).toBe(1);
  });

  it("refuses to consume below zero", async () => {
    expect(await tryConsumeMine(GUILD)).toBe(false);
    expect((await getGuildState(GUILD))?.activeMines).toBe(0);
  });

  it("puts a mine back when a detonation could not be delivered", async () => {
    await armMines(GUILD, 1);
    await tryConsumeMine(GUILD);
    await restoreMine(GUILD);

    expect((await getGuildState(GUILD))?.activeMines).toBe(1);
  });

  it("refuses to arm a guild that never ran setup", async () => {
    await expect(armMines("guild-unknown", 1)).rejects.toThrow();
  });
});

describe("guild channels", () => {
  beforeEach(async () => {
    await completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });
  });

  it("stores and reads back a channel by purpose", async () => {
    await registerGuildChannel({ guildId: GUILD, purpose: "archive", channelId: "chan-z" });

    expect((await getGuildChannel(GUILD, "archive"))?.channelId).toBe("chan-z");
  });

  it("returns undefined for a purpose the guild never registered", async () => {
    expect(await getGuildChannel(GUILD, "archive")).toBeUndefined();
  });

  it("replaces the channel when the same purpose is registered again", async () => {
    await registerGuildChannel({ guildId: GUILD, purpose: "archive", channelId: "chan-y" });
    await registerGuildChannel({ guildId: GUILD, purpose: "archive", channelId: "chan-z" });

    expect((await getGuildChannel(GUILD, "archive"))?.channelId).toBe("chan-z");
  });

  it("does not leak channels across guilds", async () => {
    await completeGuildSetup({ guildId: "guild-2", mainChannelId: "chan-b" });
    await registerGuildChannel({ guildId: "guild-2", purpose: "archive", channelId: "chan-other" });

    expect(await getGuildChannel(GUILD, "archive")).toBeUndefined();
  });
});
