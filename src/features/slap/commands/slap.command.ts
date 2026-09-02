import { logger } from "@infrastructure/config/logger.config.js";
import { TargetIsExcluded } from "@infrastructure/errors/domain.errors.js";

import { isUserExcluded, recordSlap, subtractPointsFromUser, sumPointsToUser } from "@core/services/user.service.js";

import { assetPath } from "@shared/utils/asset-path.util.js";
import { pickRandom } from "@shared/utils/pick-random.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { requireGuildMember } from "@shared/utils/guild-context.util.js";

import { NO_POINTS_MESSAGE, SLAP_COST, SLAP_RESOLUTIONS } from "../slap.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { AttachmentBuilder, MessageFlags } from "discord.js";

export class SlapCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded", "NotABot", "NotSelf"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("slap")
        .setDescription("Dale un buen golpe a alguien en los inmecionables")
        .addUserOption((option) =>
          option.setName("user").setDescription("El usuario que quieres slapear").setRequired(true),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser("user", true);
    const { guildId, member } = requireGuildMember(interaction);

    if (isUserExcluded(guildId, target.id)) {
      throw new TargetIsExcluded(guildId, target.id);
    }

    const charged = subtractPointsFromUser(guildId, member.id, SLAP_COST);

    if (!charged) {
      await interaction.reply({ content: NO_POINTS_MESSAGE, flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      recordSlap(guildId, target.id);

      const resolution = pickRandom(SLAP_RESOLUTIONS);
      const attachment = new AttachmentBuilder(assetPath("img", resolution.image), { name: resolution.image });

      await interaction.reply({
        content: formatMessage(resolution.message, { user: `<@${target.id}>` }),
        files: [attachment],
      });
    } catch (error) {
      this.refund(guildId, member.id);
      logger.error(
        { err: error, guildId, userId: member.id, targetId: target.id },
        "Slap failed after charging; points refunded",
      );
      throw error;
    }
  }

  private refund(guildId: string, userId: string): void {
    try {
      sumPointsToUser(guildId, userId, SLAP_COST);
    } catch (error) {
      logger.error({ err: error, guildId, userId }, "Failed to refund a slap that did not go through");
    }
  }
}
