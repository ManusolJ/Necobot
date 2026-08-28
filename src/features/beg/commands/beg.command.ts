import { getGuildSettings } from "@core/services/guild.service.js";
import { getGuildUser, recordBeg } from "@core/services/user.service.js";

import { randomInt } from "@shared/utils/random-int.util.js";
import { pickRandom } from "@shared/utils/pick-random.util.js";
import { isSameCalendarDay } from "@shared/utils/calendar.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { requireGuildMember } from "@shared/utils/guild-context.util.js";

import { BEG_COOLDOWN, BEG_FAIL, BEG_RETRY, BEG_SUCCESS } from "../beg.messages.js";
import {
  BEG_MAXIMUM_REWARD,
  BEG_MINIMUM_REWARD,
  BEG_FIRST_PASS_CHANCE,
  BEG_RETRY_PASS_CHANCE,
} from "../beg.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

const NO_REWARD = 0;

export class BegCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder.setName("beg").setDescription("Pideme puntos como el vagabundo que eres."),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const { guildId, member } = requireGuildMember(interaction);
    const userId = member.id;
    const displayName = member.displayName;

    const user = getGuildUser(guildId, userId);

    if (user?.lastBeggedAt && isSameCalendarDay(user.lastBeggedAt, new Date())) {
      await interaction.reply({
        content: formatMessage(pickRandom(BEG_COOLDOWN), { user: displayName }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (Math.random() < BEG_FIRST_PASS_CHANCE) {
      await this.awardBeg(interaction, guildId, userId, displayName, false);
      return;
    }

    const retryRoleId = getGuildSettings(guildId)?.begRetryRoleId;
    const hasRetryRole = Boolean(retryRoleId && member.roles.cache.has(retryRoleId));

    if (!hasRetryRole) {
      recordBeg(guildId, userId, NO_REWARD);
      await interaction.reply(formatMessage(pickRandom(BEG_FAIL), { user: displayName }));
      return;
    }

    await interaction.reply(formatMessage(pickRandom(BEG_RETRY), { user: displayName }));

    if (Math.random() < BEG_RETRY_PASS_CHANCE) {
      await this.awardBeg(interaction, guildId, userId, displayName, true);
      return;
    }

    recordBeg(guildId, userId, NO_REWARD);

    await interaction.followUp(formatMessage(pickRandom(BEG_FAIL), { user: displayName }));
  }

  private async awardBeg(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    userId: string,
    displayName: string,
    afterRetry: boolean,
  ): Promise<void> {
    const amount = randomInt(BEG_MINIMUM_REWARD, BEG_MAXIMUM_REWARD);

    recordBeg(guildId, userId, amount);

    const content = formatMessage(pickRandom(BEG_SUCCESS), { user: displayName, amount });

    if (afterRetry) {
      await interaction.followUp(content);
    } else {
      await interaction.reply(content);
    }
  }
}
