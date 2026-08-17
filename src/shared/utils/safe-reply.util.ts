import { logger } from "@infrastructure/config/logger.config.js";

import type { InteractionReplyOptions, RepliableInteraction } from "discord.js";

export async function safeReply(interaction: RepliableInteraction, reply: InteractionReplyOptions): Promise<void> {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  } catch (error) {
    logger.warn(
      { err: error, interactionId: interaction.id, userId: interaction.user.id },
      "Failed to deliver error reply to the user",
    );
  }
}
