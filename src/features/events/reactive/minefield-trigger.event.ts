import { logger } from "@infrastructure/config/logger.config.js";

import { isUserExcluded, recordMineHit } from "@core/services/user.service.js";
import { getGuildSettings, restoreMine, tryConsumeMine } from "@core/services/guild.service.js";

import {
  MINE_TIMEOUT_MS,
  MINE_ADMIN_PENALTY,
  MINE_TRIGGER_CHANCE,
  MINE_TIMEOUT_REASON,
  MINE_TIMEOUT_SECONDS,
  MINE_NO_POINT_PENALTY,
} from "@shared/consts/minefield.constants.js";

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

    let announcement: string;

    try {
      announcement = await this.detonate(message);
    } catch (error) {
      restoreMine(message.guildId);
      logger.error(
        { err: error, guildId: message.guildId, userId: message.author.id },
        "Failed to apply mine detonation; mine restored",
      );
      return;
    }

    await message.reply(announcement).catch((error: unknown) => {
      logger.warn({ err: error, guildId: message.guildId }, "Failed to announce mine detonation");
    });
  }

  private async detonate(message: Message<true>): Promise<string> {
    const member = message.member;
    const isAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;

    if (!isAdmin && member?.moderatable) {
      await member.timeout(MINE_TIMEOUT_MS, MINE_TIMEOUT_REASON);
      recordMineHit(message.guildId, message.author.id, MINE_NO_POINT_PENALTY);

      return `**BOOM.** ${member.displayName} ha pisado una mina y estará calladito ${MINE_TIMEOUT_SECONDS} segundos. Nyaha~.`;
    }

    recordMineHit(message.guildId, message.author.id, MINE_ADMIN_PENALTY);

    return `**BOOM.** <@${message.author.id}> ha pisado una mina. Como eres intocable, pagas **${MINE_ADMIN_PENALTY}** puntos. La ley es la ley.`;
  }
}
