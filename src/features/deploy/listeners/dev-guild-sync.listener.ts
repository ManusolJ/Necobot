import { env } from "@infrastructure/config/env.config.js";
import { logger } from "@infrastructure/config/logger.config.js";

import { syncGlobalsToGuild } from "../deploy.service.js";

import { Events, Listener } from "@sapphire/framework";

export class DevGuildSyncListener extends Listener<typeof Events.ApplicationCommandRegistriesRegistered> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ApplicationCommandRegistriesRegistered, once: true });
  }

  public override async run(): Promise<void> {
    const guildId = env.DISCORD_DEV_GUILD_ID;

    if (guildId === undefined) {
      return;
    }

    try {
      const names = await syncGlobalsToGuild(this.container.client, guildId);
      logger.info({ guildId, count: names.length }, "Mirrored global commands to the dev guild");
    } catch (error) {
      logger.error({ err: error, guildId }, "Failed to mirror commands to the dev guild");
    }
  }
}
