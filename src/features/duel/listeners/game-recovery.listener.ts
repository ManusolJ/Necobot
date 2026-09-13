import { logger } from "@infrastructure/config/logger.config.js";

import { recoverOpenGameSessions } from "@core/services/game-session.service.js";

import type { GameSession } from "@shared/types/game-session.type.js";

import { EMBED_COLOR } from "@shared/consts/branding.constants.js";

import { DUEL_RECOVERED } from "../duel.messages.js";

import { EmbedBuilder } from "discord.js";
import { Events, Listener } from "@sapphire/framework";

export class GameRecoveryListener extends Listener<typeof Events.ClientReady> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ClientReady, once: true });
  }

  public override async run(): Promise<void> {
    let recovered: GameSession[];

    try {
      recovered = recoverOpenGameSessions();
    } catch (error) {
      logger.error({ err: error }, "Failed to refund game sessions left open by a previous process");
      return;
    }

    if (recovered.length === 0) {
      return;
    }

    logger.info(
      { recovered: recovered.length, sessions: recovered.map((session) => session.id) },
      "Refunded game sessions left open by a previous process",
    );

    for (const session of recovered) {
      await this.closeMessage(session);
    }
  }

  private async closeMessage(session: GameSession): Promise<void> {
    if (!session.channelId || !session.messageId) {
      return;
    }

    const channel = await this.container.client.channels.fetch(session.channelId).catch(() => null);

    if (!channel?.isSendable()) {
      return;
    }

    const message = await channel.messages.fetch(session.messageId).catch(() => null);

    if (!message) {
      return;
    }

    const [existing] = message.embeds;
    const embed = existing ? EmbedBuilder.from(existing) : new EmbedBuilder().setColor(EMBED_COLOR).setTitle("Duelo");

    await message.edit({ embeds: [embed.setDescription(DUEL_RECOVERED)], components: [] }).catch((error: unknown) => {
      logger.warn({ err: error, sessionId: session.id }, "Could not close the message of a recovered game session");
    });
  }
}
