import { AppError } from "@infrastructure/errors/app-error.js";
import { logger } from "@infrastructure/config/logger.config.js";

import type { ScheduledTask } from "@sapphire/plugin-scheduled-tasks";

import { Listener } from "@sapphire/framework";
import { ScheduledTaskEvents } from "@sapphire/plugin-scheduled-tasks";

export class ScheduledTaskErrorListener extends Listener<typeof ScheduledTaskEvents.ScheduledTaskError> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: ScheduledTaskEvents.ScheduledTaskError });
  }

  public override run(error: unknown, task: ScheduledTask): void {
    const isDomain = error instanceof AppError;

    logger.error(
      {
        err: error,
        task: task.name,
        ...(isDomain ? { code: error.code, context: error.context } : {}),
      },
      "Scheduled task threw an error",
    );
  }
}
