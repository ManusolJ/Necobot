import { getGuildUser, recordBeg } from "@core/services/user.service.js";
import { findGuildSettings } from "@core/repositories/guild.repository.js";

import { randomInt } from "@shared/utils/random-int.util.js";
import { pickRandom } from "@shared/utils/pick-random.util.js";
import { isSameUTCDay } from "@shared/utils/is-same-day.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { BEG_COOLDOWN, BEG_FAIL, BEG_RETRY, BEG_SUCCESS } from "@shared/consts/beg-message.constants.js";

import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { MessageFlags, type ChatInputCommandInteraction, type GuildMember } from "discord.js";

const MINIMUM_REWARD = 1;
const MAXIMUM_REWARD = 100;
const FIRST_PASS_CHANCE = 0.6;
const RETRY_PASS_CHANCE = 0.3;

export class BegCommand extends Command {
  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder.setName("beg").setDescription("Pideme puntos como el vagabundo que eres."),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;
    const member = interaction.member as GuildMember | null;
    const displayName = member?.displayName ?? interaction.user.username;

    const user = getGuildUser(guildId, userId);

    if (user?.lastBeggedAt && isSameUTCDay(user.lastBeggedAt, new Date())) {
      await interaction.reply({
        content: formatMessage(pickRandom(BEG_COOLDOWN), { user: displayName }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (Math.random() < FIRST_PASS_CHANCE) {
      await this.awardBeg(interaction, guildId, userId, displayName, false);
      return;
    }

    const settings = findGuildSettings(guildId);
    const retryRoleId = settings?.begRetryRoleId ?? null;
    const hasRetryRole = Boolean(retryRoleId && member?.roles.cache.has(retryRoleId));

    if (!hasRetryRole) {
      recordBeg(guildId, userId, 0);
      await interaction.reply(formatMessage(pickRandom(BEG_FAIL), { user: displayName }));
      return;
    }

    await interaction.reply(formatMessage(pickRandom(BEG_RETRY), { user: displayName }));

    if (Math.random() < RETRY_PASS_CHANCE) {
      await this.awardBeg(interaction, guildId, userId, displayName, true);
      return;
    }

    recordBeg(guildId, userId, 0);

    await interaction.followUp(formatMessage(pickRandom(BEG_FAIL), { user: displayName }));
  }

  private async awardBeg(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    userId: string,
    displayName: string,
    afterRetry: boolean,
  ): Promise<void> {
    const amount = randomInt(MINIMUM_REWARD, MAXIMUM_REWARD);

    recordBeg(guildId, userId, amount);

    const content = formatMessage(pickRandom(BEG_SUCCESS), { user: displayName, amount });

    if (afterRetry) {
      await interaction.followUp(content);
    } else {
      await interaction.reply(content);
    }
  }
}
