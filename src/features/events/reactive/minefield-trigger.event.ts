import { logger } from "@infrastructure/config/logger.config.js";

import { isUserExcluded, recordMineHit } from "@core/services/user.service.js";
import { getGuildSettings, tryConsumeMine } from "@core/services/guild.service.js";

import { MINE_ADMIN_PENALTY, MINE_TIMEOUT_MS, MINE_TRIGGER_CHANCE } from "@shared/consts/minefield.constants.js";

import type { Message } from "discord.js";

import { PermissionFlagsBits } from "discord.js";
import { Events, Listener } from "@sapphire/framework";

export class MinefieldTriggerListener extends Listener<typeof Events.MessageCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public override async run(message: Message): Promise<void> {
    if (!message.inGuild() || message.author.bot) {
      return;
    }

    const settings = getGuildSettings(message.guildId);
    if (!settings?.mainChannelId || message.channelId !== settings.mainChannelId || settings.activeMines <= 0) {
      return;
    }

    if (Math.random() >= MINE_TRIGGER_CHANCE) {
      return;
    }

    if (isUserExcluded(message.guildId, message.author.id)) {
      return;
    }

    if (!tryConsumeMine(message.guildId)) {
      return;
    }

    try {
      const member = message.member;
      const isAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;

      if (!isAdmin && member?.moderatable) {
        await member.timeout(MINE_TIMEOUT_MS, "Pisó una mina del minefield");
        recordMineHit(message.guildId, message.author.id, 0);
        await message.reply(
          `💥 **BOOM.** ${member.displayName} ha pisado una mina y estará calladito ${MINE_TIMEOUT_MS / 1000} segundos. Nyaha~.`,
        );
        return;
      }

      recordMineHit(message.guildId, message.author.id, MINE_ADMIN_PENALTY);
      await message.reply(
        `💥 **BOOM.** <@${message.author.id}> ha pisado una mina. Como eres intocable, pagas **${MINE_ADMIN_PENALTY}** puntos. La ley es la ley.`,
      );
    } catch (error) {
      logger.error(
        { err: error, guildId: message.guildId, userId: message.author.id },
        "Failed to apply mine detonation",
      );
    }
  }
}
