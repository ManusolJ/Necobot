import { GuildChannelPersistError, GuildSettingsPersistError } from "@infrastructure/errors/domain.errors.js";

import type { GuildChannel } from "@shared/types/guild-channel.type.js";
import type { GuildSettings } from "@shared/types/guild-settings.type.js";
import type { GuildSettingsInsert } from "@shared/types/guild-settings-insert.type.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

const consumeGuildMine = vi.hoisted(() => vi.fn());
const findGuildSettings = vi.hoisted(() => vi.fn());
const upsertGuildChannel = vi.hoisted(() => vi.fn());
const incrementGuildMines = vi.hoisted(() => vi.fn());
const upsertGuildSettings = vi.hoisted(() => vi.fn());

vi.mock("@core/repositories/guild.repository.js", () => ({
  consumeGuildMine,
  findGuildSettings,
  upsertGuildChannel,
  incrementGuildMines,
  upsertGuildSettings,
}));

const { armMines, restoreMine, tryConsumeMine, getGuildSettings, completeGuildSetup, registerGuildChannel } =
  await import("@core/services/guild.service.js");

const GUILD = "guild-1";

function guildSettings(overrides: Partial<GuildSettings> = {}): GuildSettings {
  return {
    guildId: GUILD,
    mainChannelId: "main-channel",
    prefix: "!",
    setupCompletedAt: null,
    begRetryRoleId: null,
    activeMines: 0,
    ...overrides,
  };
}

function updatesOf(call = 0): Partial<GuildSettingsInsert> {
  return upsertGuildSettings.mock.calls[call]?.[1] as Partial<GuildSettingsInsert>;
}

function valuesOf(call = 0): GuildSettingsInsert {
  return upsertGuildSettings.mock.calls[call]?.[0] as GuildSettingsInsert;
}

beforeEach(() => {
  consumeGuildMine.mockReset();
  findGuildSettings.mockReset();
  upsertGuildChannel.mockReset();
  incrementGuildMines.mockReset();
  upsertGuildSettings.mockReset();
});

describe("getGuildSettings", () => {
  // Normal case: the service reads straight through, so the stored settings row must come back as-is.
  it("returns the row the repository found", () => {
    const row = guildSettings();
    findGuildSettings.mockReturnValue(row);

    expect(getGuildSettings(GUILD)).toBe(row);
    expect(findGuildSettings).toHaveBeenCalledWith(GUILD);
  });

  // Edge case: an unconfigured guild has no row, and the precondition depends on that undefined to block commands.
  it("returns undefined for an unconfigured guild", () => {
    findGuildSettings.mockReturnValue(undefined);

    expect(getGuildSettings(GUILD)).toBeUndefined();
  });
});

describe("completeGuildSetup", () => {
  // Normal case: running setup stamps the completion time onto the values sent to the upsert.
  it("stamps the setup completion time", () => {
    upsertGuildSettings.mockReturnValue(guildSettings({ setupCompletedAt: new Date() }));

    completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a" });

    expect(valuesOf().setupCompletedAt).toBeInstanceOf(Date);
    expect(valuesOf().guildId).toBe(GUILD);
  });

  // Normal case: every field the caller supplied has to reach the update clause so a re-run overwrites the old value.
  it("promotes all supplied fields into the update clause", () => {
    upsertGuildSettings.mockReturnValue(guildSettings());

    completeGuildSetup({ guildId: GUILD, mainChannelId: "chan-a", prefix: "?", begRetryRoleId: "role-1" });

    expect(updatesOf()).toEqual({ mainChannelId: "chan-a", prefix: "?", begRetryRoleId: "role-1" });
  });

  // Edge case: omitted fields must stay out of the update clause so a partial re-run does not blank existing settings.
  it("leaves omitted fields out of the update clause", () => {
    upsertGuildSettings.mockReturnValue(guildSettings());

    completeGuildSetup({ guildId: GUILD, prefix: "?" });

    expect(updatesOf()).toEqual({ prefix: "?" });
  });

  // Edge case: with nothing to update the repository takes its insert-or-read path, driven by an empty update clause.
  it("sends an empty update clause when only the guild id is given", () => {
    upsertGuildSettings.mockReturnValue(guildSettings());

    completeGuildSetup({ guildId: GUILD });

    expect(updatesOf()).toEqual({});
  });

  // Edge case: an explicit null is a deliberate clear and must be forwarded, unlike an omitted field.
  it("forwards an explicit null as a value to clear", () => {
    upsertGuildSettings.mockReturnValue(guildSettings({ mainChannelId: null }));

    completeGuildSetup({ guildId: GUILD, mainChannelId: null });

    expect(updatesOf()).toEqual({ mainChannelId: null });
  });

  // Normal case: the saved row is what the command echoes back to the user, so it must be returned unchanged.
  it("returns the saved row", () => {
    const row = guildSettings({ prefix: "?" });
    upsertGuildSettings.mockReturnValue(row);

    expect(completeGuildSetup({ guildId: GUILD, prefix: "?" })).toBe(row);
  });

  // Error handling: a failed upsert must throw rather than report a setup that never persisted.
  it("throws when the write returns no row", () => {
    upsertGuildSettings.mockReturnValue(undefined);

    expect(() => completeGuildSetup({ guildId: GUILD, prefix: "?" })).toThrow(GuildSettingsPersistError);
  });

  // Error handling: the error carries the guild id so the failure can be traced back to a specific server.
  it("puts the guild id on the thrown error", () => {
    upsertGuildSettings.mockReturnValue(undefined);

    expect(() => completeGuildSetup({ guildId: GUILD })).toThrow(
      expect.objectContaining({ code: "guild_settings_persist_failed", context: { guildId: GUILD } }),
    );
  });
});

describe("registerGuildChannel", () => {
  // Normal case: the channel registration is passed through untouched and the stored row returned.
  it("returns the stored channel", () => {
    const row: GuildChannel = { guildId: GUILD, purpose: "logs", channelId: "chan-b" };
    upsertGuildChannel.mockReturnValue(row);

    expect(registerGuildChannel({ guildId: GUILD, purpose: "logs", channelId: "chan-b" })).toBe(row);
    expect(upsertGuildChannel).toHaveBeenCalledWith({ guildId: GUILD, purpose: "logs", channelId: "chan-b" });
  });

  // Error handling: a failed write throws with the purpose attached, since that is what identifies the mapping.
  it("throws with the purpose when the write returns no row", () => {
    upsertGuildChannel.mockReturnValue(undefined);

    expect(() => registerGuildChannel({ guildId: GUILD, purpose: "logs", channelId: "chan-b" })).toThrow(
      GuildChannelPersistError,
    );
    expect(() => registerGuildChannel({ guildId: GUILD, purpose: "logs", channelId: "chan-b" })).toThrow(
      expect.objectContaining({ context: { guildId: GUILD, purpose: "logs" } }),
    );
  });
});

describe("armMines", () => {
  // Normal case: arming forwards the count and returns the settings row holding the new mine total.
  it("increments by the requested count", () => {
    const row = guildSettings({ activeMines: 5 });
    incrementGuildMines.mockReturnValue(row);

    expect(armMines(GUILD, 5)).toBe(row);
    expect(incrementGuildMines).toHaveBeenCalledWith(GUILD, 5);
  });

  // Edge case: arming zero mines is a harmless no-op that still has to return the current settings row.
  it("handles a count of zero", () => {
    const row = guildSettings({ activeMines: 0 });
    incrementGuildMines.mockReturnValue(row);

    expect(armMines(GUILD, 0)).toBe(row);
  });

  // Error handling: an unconfigured guild matches no row to update, which must surface as a persist error.
  it("throws when no settings row matched", () => {
    incrementGuildMines.mockReturnValue(undefined);

    expect(() => armMines(GUILD, 5)).toThrow(GuildSettingsPersistError);
  });
});

describe("tryConsumeMine", () => {
  // Normal case: a conditional decrement that returned a row means a mine was claimed for this message.
  it("reports success when a mine was decremented", () => {
    consumeGuildMine.mockReturnValue(guildSettings({ activeMines: 2 }));

    expect(tryConsumeMine(GUILD)).toBe(true);
    expect(consumeGuildMine).toHaveBeenCalledWith(GUILD);
  });

  // Edge case: with no mines left the guarded update matches nothing, which must read as a plain false.
  it("reports failure when no mine was available", () => {
    consumeGuildMine.mockReturnValue(undefined);

    expect(tryConsumeMine(GUILD)).toBe(false);
  });

  // Edge case: the result is a boolean rather than the row itself, so callers can use it directly in a condition.
  it("maps the row onto a boolean rather than leaking it", () => {
    consumeGuildMine.mockReturnValue(guildSettings({ activeMines: 0 }));

    expect(tryConsumeMine(GUILD)).toBe(true);
  });
});

describe("restoreMine", () => {
  // Normal case: restoring gives back exactly the single mine that was consumed.
  it("increments by exactly one", () => {
    incrementGuildMines.mockReturnValue(guildSettings({ activeMines: 1 }));

    restoreMine(GUILD);

    expect(incrementGuildMines).toHaveBeenCalledWith(GUILD, 1);
  });

  // Error handling: restore runs on a failure path, so it must swallow a failed write instead of masking the original error.
  it("does not throw when the write returns no row", () => {
    incrementGuildMines.mockReturnValue(undefined);

    expect(() => {
      restoreMine(GUILD);
    }).not.toThrow();
  });

  // Normal case: the function is deliberately fire-and-forget and reports nothing back to the caller.
  it("returns nothing", () => {
    incrementGuildMines.mockReturnValue(guildSettings());

    expect(restoreMine(GUILD)).toBeUndefined();
  });
});
