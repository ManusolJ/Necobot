import { db } from "@infrastructure/database/client.js";
import { guildState, guildChannels, guildSettings } from "@infrastructure/database/schema/guild.schema.js";

import type { DbExecutor } from "@shared/types/db-executor.type.js";
import type { GuildState } from "@shared/types/guild-state.type.js";
import type { GuildChannel } from "@shared/types/guild-channel.type.js";
import type { GuildSettings } from "@shared/types/guild-settings.type.js";
import type { ChannelPurpose } from "@shared/types/channel-purpose.type.js";
import type { GuildChannelInsert } from "@shared/types/guild-channel-insert.type.js";
import type { GuildSettingsInsert } from "@shared/types/guild-settings-insert.type.js";

import { and, eq, gt, sql } from "drizzle-orm";

export async function findGuildSettings(
  guildId: string,
  executor: DbExecutor = db,
): Promise<GuildSettings | undefined> {
  const [row] = await executor.select().from(guildSettings).where(eq(guildSettings.guildId, guildId));

  return row;
}

export async function findGuildState(guildId: string, executor: DbExecutor = db): Promise<GuildState | undefined> {
  const [row] = await executor.select().from(guildState).where(eq(guildState.guildId, guildId));

  return row;
}

export async function incrementGuildMines(
  guildId: string,
  count: number,
  executor: DbExecutor = db,
): Promise<GuildState | undefined> {
  const [row] = await executor
    .update(guildState)
    .set({ activeMines: sql`${guildState.activeMines} + ${count}` })
    .where(eq(guildState.guildId, guildId))
    .returning();

  return row;
}

export async function consumeGuildMine(guildId: string, executor: DbExecutor = db): Promise<GuildState | undefined> {
  const [row] = await executor
    .update(guildState)
    .set({ activeMines: sql`${guildState.activeMines} - 1` })
    .where(and(eq(guildState.guildId, guildId), gt(guildState.activeMines, 0)))
    .returning();

  return row;
}

export async function upsertGuildSettings(
  settings: GuildSettingsInsert,
  updates: Partial<GuildSettingsInsert>,
  executor: DbExecutor = db,
): Promise<GuildSettings | undefined> {
  return executor.transaction(async (tx) => {
    const insert = tx.insert(guildSettings).values(settings);

    const [row] =
      Object.keys(updates).length === 0
        ? await insert.onConflictDoNothing().returning()
        : await insert.onConflictDoUpdate({ target: guildSettings.guildId, set: updates }).returning();

    await tx.insert(guildState).values({ guildId: settings.guildId }).onConflictDoNothing();

    return row ?? findGuildSettings(settings.guildId, tx);
  });
}

export async function upsertGuildChannel(
  channel: GuildChannelInsert,
  executor: DbExecutor = db,
): Promise<GuildChannel | undefined> {
  const [row] = await executor
    .insert(guildChannels)
    .values(channel)
    .onConflictDoUpdate({
      target: [guildChannels.guildId, guildChannels.purpose],
      set: { channelId: channel.channelId },
    })
    .returning();

  return row;
}

export async function findChannelsByPurpose(
  purpose: ChannelPurpose,
  executor: DbExecutor = db,
): Promise<GuildChannel[]> {
  return executor.select().from(guildChannels).where(eq(guildChannels.purpose, purpose));
}

export async function findGuildChannel(
  guildId: string,
  purpose: ChannelPurpose,
  executor: DbExecutor = db,
): Promise<GuildChannel | undefined> {
  const [row] = await executor
    .select()
    .from(guildChannels)
    .where(and(eq(guildChannels.guildId, guildId), eq(guildChannels.purpose, purpose)));

  return row;
}
