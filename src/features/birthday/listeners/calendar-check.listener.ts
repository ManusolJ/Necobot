import { logger } from "@infrastructure/config/logger.config.js";

import { nowInBotZone } from "@shared/utils/calendar.util.js";

import { runBirthdaySweep } from "../birthday.service.js";
import { BIRTHDAY_SWEEP_HOUR } from "../birthday.constants.js";

import { Events, Listener } from "@sapphire/framework";

export class CalendarCheckListener extends Listener<typeof Events.ClientReady> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ClientReady, once: true });
  }

  public override async run(): Promise<void> {
    const now = nowInBotZone();

    if (now.hour < BIRTHDAY_SWEEP_HOUR) {
      logger.debug({ hour: now.hour }, "Booted before the birthday sweep hour; leaving it to the cron");
      return;
    }

    logger.info({ hour: now.hour }, "Booted after the birthday sweep hour; running the catch-up sweep");

    try {
      await runBirthdaySweep(now);
    } catch (error) {
      logger.error({ err: error }, "Birthday catch-up sweep failed");
    }
  }
}
