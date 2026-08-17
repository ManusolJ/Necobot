import { logger } from "@infrastructure/config/logger.config.js";

import { safeReply } from "@shared/utils/safe-reply.util.js";

import type { ChatInputCommandDeniedPayload, UserError } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Events, Listener } from "@sapphire/framework";

export class CommandDeniedListener extends Listener<typeof Events.ChatInputCommandDenied> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ChatInputCommandDenied });
  }

  public override async run(error: UserError, payload: ChatInputCommandDeniedPayload): Promise<void> {
    logger.info(
      {
        command: payload.command.name,
        userId: payload.interaction.user.id,
        guildId: payload.interaction.guildId,
        identifier: error.identifier,
        reason: error.message,
      },
      "Command denied by precondition",
    );

    await safeReply(payload.interaction, {
      content: error.message,
      flags: MessageFlags.Ephemeral,
    });
  }
}
