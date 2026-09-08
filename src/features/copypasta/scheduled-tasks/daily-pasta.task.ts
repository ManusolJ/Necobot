import { logger } from "@infrastructure/config/logger.config.js";
import { fetchTopPosts } from "@infrastructure/reddit/reddit.client.js";
import { CopypastaFetchError } from "@infrastructure/errors/domain.errors.js";

import { getChannelsByPurpose } from "@core/services/guild.service.js";

import { BOT_TIMEZONE } from "@shared/consts/config.constants.js";

import { pickCopypasta, formatCopypasta } from "../copypasta.service.js";
import {
  COPYPASTA_CRON,
  COPYPASTA_SUBREDDIT,
  COPYPASTA_TIMEFRAME,
  COPYPASTA_FETCH_LIMIT,
  COPYPASTA_RETRY_DELAY_MS,
  COPYPASTA_RETRY_ATTEMPTS,
  COPYPASTA_CHANNEL_PURPOSE,
} from "../copypasta.constants.js";

import { ScheduledTask } from "@sapphire/plugin-scheduled-tasks";

declare module "@sapphire/plugin-scheduled-tasks" {
  interface ScheduledTasks {
    dailyPasta: never;
  }
}

export class DailyPastaTask extends ScheduledTask<"dailyPasta"> {
  public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
    super(context, {
      ...options,
      name: "dailyPasta",
      pattern: COPYPASTA_CRON,
      timezone: BOT_TIMEZONE,
      customJobOptions: {
        attempts: COPYPASTA_RETRY_ATTEMPTS,
        backoff: { type: "exponential", delay: COPYPASTA_RETRY_DELAY_MS },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    });
  }

  public override async run(): Promise<void> {
    const channels = getChannelsByPurpose(COPYPASTA_CHANNEL_PURPOSE);

    if (channels.length === 0) {
      logger.debug("No guild has a copypasta channel configured; skipping the daily pasta");
      return;
    }

    const posts = await fetchTopPosts(COPYPASTA_SUBREDDIT, COPYPASTA_TIMEFRAME, COPYPASTA_FETCH_LIMIT);

    if (!posts) {
      throw new CopypastaFetchError(COPYPASTA_SUBREDDIT);
    }

    const post = pickCopypasta(posts);

    if (!post) {
      logger.warn(
        { subreddit: COPYPASTA_SUBREDDIT },
        "No copypasta was eligible; every candidate was too short or already posted",
      );
      return;
    }

    const content = formatCopypasta(post);

    for (const { guildId, channelId } of channels) {
      const channel = await this.container.client.channels.fetch(channelId).catch(() => null);

      if (!channel?.isSendable()) {
        logger.warn({ guildId, channelId }, "Copypasta channel unavailable; skipping this guild");
        continue;
      }

      try {
        await channel.send({ content, allowedMentions: { parse: [] } });
      } catch (error) {
        logger.warn({ err: error, guildId, channelId }, "Could not send the copypasta; skipping this guild");
      }
    }
  }
}
