import { logger } from "@infrastructure/config/logger.config.js";
import { AppError } from "@infrastructure/errors/app-error.js";

import { getUserErrorMessage } from "@shared/utils/error-messages.util.js";

import { Events, Listener } from "@sapphire/framework";
import type { ChatInputCommandErrorPayload } from "@sapphire/framework";

import { MessageFlags, type InteractionReplyOptions } from "discord.js";

export class CommandErrorListener extends Listener<typeof Events.ChatInputCommandError> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ChatInputCommandError });
  }

  public override async run(error: unknown, payload: ChatInputCommandErrorPayload) {
    const isDomain = error instanceof AppError;
    const userMessage = isDomain ? getUserErrorMessage(error.code) : getUserErrorMessage("__unknown__");

    const logPayload = {
      err: error,
      command: payload.command.name,
      userId: payload.interaction.user.id,
      guildId: payload.interaction.guildId,
      ...(isDomain ? { code: error.code, context: error.context } : {}),
    };

    if (isDomain) {
      logger.warn(logPayload, "Command threw a domain error");
    } else {
      logger.error(logPayload, "Command threw an unexpected error");
    }

    const reply: InteractionReplyOptions = {
      content: userMessage,
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
