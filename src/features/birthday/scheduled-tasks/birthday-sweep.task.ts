import { BOT_TIMEZONE } from "@shared/consts/config.constants.js";

import { runBirthdaySweep } from "../birthday.service.js";
import { BIRTHDAY_CRON, BIRTHDAY_RETRY_DELAY_MS, BIRTHDAY_RETRY_ATTEMPTS } from "../birthday.constants.js";

import { ScheduledTask } from "@sapphire/plugin-scheduled-tasks";

declare module "@sapphire/plugin-scheduled-tasks" {
  interface ScheduledTasks {
    birthdaySweep: never;
  }
}

export class BirthdaySweepTask extends ScheduledTask<"birthdaySweep"> {
  public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
    super(context, {
      ...options,
      name: "birthdaySweep",
      pattern: BIRTHDAY_CRON,
      timezone: BOT_TIMEZONE,
      customJobOptions: {
        attempts: BIRTHDAY_RETRY_ATTEMPTS,
        backoff: { type: "exponential", delay: BIRTHDAY_RETRY_DELAY_MS },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    });
  }

  public override async run(): Promise<void> {
    await runBirthdaySweep();
  }
}
