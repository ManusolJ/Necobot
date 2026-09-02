import { logger } from "@infrastructure/config/logger.config.js";
import { TargetIsExcluded } from "@infrastructure/errors/domain.errors.js";

import {
  isUserExcluded,
  sumPointsToUser,
  setUserUwufication,
  subtractPointsFromUser,
} from "@core/services/user.service.js";

import { pickRandom } from "@shared/utils/pick-random.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { requireGuildMember } from "@shared/utils/guild-context.util.js";

import { UWUFY_APPLIED, UWUFY_NO_POINTS } from "../uwufier.messages.js";
import { UWUFY_COST, UWUFY_MESSAGE_COUNT } from "../uwufier.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

export class UwufierCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded", "NotABot"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("uwufier")
        .setDescription(
          `Haz que los siguientes ${String(UWUFY_MESSAGE_COUNT)} mensajes de alguien sean uwuficados (${String(UWUFY_COST)}pts)`,
        )
        .addUserOption((option) =>
          option.setName("user").setDescription("Quien quieres que uwufique").setRequired(true),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser("user", true);
    const { guildId, member } = requireGuildMember(interaction);

    if (isUserExcluded(guildId, target.id)) {
      throw new TargetIsExcluded(guildId, target.id);
    }

    const charged = subtractPointsFromUser(guildId, member.id, UWUFY_COST);

    if (!charged) {
      await interaction.reply({ content: UWUFY_NO_POINTS, flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      setUserUwufication(guildId, target.id, UWUFY_MESSAGE_COUNT);

      await interaction.reply({
        content: formatMessage(pickRandom(UWUFY_APPLIED), {
          user: `<@${target.id}>`,
          count: UWUFY_MESSAGE_COUNT,
        }),
        allowedMentions: { users: [target.id] },
      });
    } catch (error) {
      this.refund(guildId, member.id);
      logger.error(
        { err: error, guildId, userId: member.id, targetId: target.id },
        "Uwufication failed after charging; points refunded",
      );
      throw error;
    }
  }

  private refund(guildId: string, userId: string): void {
    try {
      sumPointsToUser(guildId, userId, UWUFY_COST);
    } catch (error) {
      logger.error({ err: error, guildId, userId }, "Failed to refund a uwufication that did not go through");
    }
  }
}
