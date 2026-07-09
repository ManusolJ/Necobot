import { logger } from "@infrastructure/config/logger.config.js";

import type { InteractionReplyOptions } from "discord.js";
import type { ChatInputCommandDeniedPayload, UserError } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Events, Listener } from "@sapphire/framework";

export class CommandDeniedListener extends Listener<typeof Events.ChatInputCommandDenied> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ChatInputCommandDenied });
  }

  public override async run(error: UserError, payload: ChatInputCommandDeniedPayload) {
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

    const reply: InteractionReplyOptions = {
      content: error.message,
      flags: MessageFlags.Ephemeral,
    };

    try {
      if (payload.interaction.replied || payload.interaction.deferred) {
        await payload.interaction.followUp(reply);
      } else {
        await payload.interaction.reply(reply);
      }
    } catch {}
  }
}
