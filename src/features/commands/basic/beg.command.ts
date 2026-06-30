import { getGuildUser, recordBeg } from "@core/services/user.service.js";
import { findGuildSettings } from "@core/repositories/guild.repository.js";

import { pickRandom } from "@shared/utils/pick-random.util.js";
import { isSameUTCDay } from "@shared/utils/is-same-day.util.js";
import { pointGenerator } from "@shared/utils/point-generator.util.js";
import { BEG_COOLDOWN, BEG_FAIL, BEG_RETRY, BEG_SUCCESS } from "@shared/consts/beg-message.constants.js";

import { Command } from "@sapphire/framework";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

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

    const user = getGuildUser(guildId, userId);

    if (user?.lastBeggedAt && isSameUTCDay(user.lastBeggedAt, new Date())) {
      await interaction.reply({
        content: pickRandom(BEG_COOLDOWN),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (Math.random() < FIRST_PASS_CHANCE) {
      await this.awardBeg(interaction, guildId, userId, false);
      return;
    }

    const settings = findGuildSettings(guildId);
    const retryRoleId = settings?.begRetryRoleId ?? null;
    const member = interaction.member as GuildMember | null;
    const hasRetryRole = Boolean(retryRoleId && member?.roles.cache.has(retryRoleId));

    if (!hasRetryRole) {
      recordBeg(guildId, userId, 0);
      await interaction.reply(pickRandom(BEG_FAIL));
      return;
    }

    await interaction.reply(pickRandom(BEG_RETRY));

    if (Math.random() < RETRY_PASS_CHANCE) {
      await this.awardBeg(interaction, guildId, userId, true);
      return;
    }

    recordBeg(guildId, userId, 0);

    await interaction.followUp(pickRandom(BEG_FAIL));
  }

  private async awardBeg(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    userId: string,
    afterRetry: boolean,
  ): Promise<void> {
    const amount = pointGenerator(MINIMUM_REWARD, MAXIMUM_REWARD);

    recordBeg(guildId, userId, amount);

    const content = pickRandom(BEG_SUCCESS).replace("{amount}", String(amount));

    if (afterRetry) {
      await interaction.followUp(content);
    } else {
      await interaction.reply(content);
    }
  }
}
