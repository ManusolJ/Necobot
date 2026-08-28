import { AppError } from "@infrastructure/errors/app-error.js";
import { logger } from "@infrastructure/config/logger.config.js";

import { safeReply } from "@shared/utils/safe-reply.util.js";
import { FALLBACK_MESSAGE, getUserErrorMessage } from "@shared/utils/error-messages.util.js";

import type { ChatInputCommandErrorPayload } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Events, Listener } from "@sapphire/framework";

export class CommandErrorListener extends Listener<typeof Events.ChatInputCommandError> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ChatInputCommandError });
  }

  public override async run(error: unknown, payload: ChatInputCommandErrorPayload): Promise<void> {
    const isDomain = error instanceof AppError;
    const userMessage = isDomain ? getUserErrorMessage(error.code) : FALLBACK_MESSAGE;

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

    await safeReply(payload.interaction, {
      content: userMessage,
      flags: MessageFlags.Ephemeral,
    });
  }
}
