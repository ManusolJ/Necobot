import { db } from "@infrastructure/database/client.js";

import { guildSettings } from "@infrastructure/database/schema/guild.schema.js";

import { eq } from "drizzle-orm";

import { Precondition } from "@sapphire/framework";

import type { ChatInputCommandInteraction } from "discord.js";

export class GuildConfiguredPrecondition extends Precondition {
  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      return this.error({ message: "This bot is guild-only." });
    }

    const settings = db
      .select()
      .from(guildSettings)
      .where(eq(guildSettings.guildId, interaction.guildId))
      .get();

    if (!settings || settings.setupCompletedAt == null) {
      return this.error({
        message: "An admin must run `/setup` before the bot can be used here.",
      });
    }

    return this.ok();
  }
}
