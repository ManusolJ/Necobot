import { GuildNotConfiguredError } from "@infrastructure/errors/domain.errors.js";

import { getGuildSettings } from "@core/services/guild.service.js";

import { Precondition } from "@sapphire/framework";
import type { ChatInputCommandInteraction } from "discord.js";

import { getUserErrorMessage } from "@shared/utils/error-messages.util.js";

export class GuildConfiguredPrecondition extends Precondition {
  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      return this.error({ message: "This bot is guild-only." });
    }

    const settings = getGuildSettings(interaction.guildId);

    if (!settings || settings.setupCompletedAt == null) {
      const err = new GuildNotConfiguredError(interaction.guildId);
      return this.error({
        message: getUserErrorMessage(err.code),
        context: { code: err.code },
      });
    }

    return this.ok();
  }
}
