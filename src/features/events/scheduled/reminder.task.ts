import { logger } from "@infrastructure/config/logger.config.js";

import { ScheduledTask } from "@sapphire/plugin-scheduled-tasks";

declare module "@sapphire/plugin-scheduled-tasks" {
  interface ScheduledTasks {
    reminder: ReminderPayload;
  }
}

export interface ReminderPayload {
  channelId: string;
  userId: string;
  note: string | null;
}

export class ReminderTask extends ScheduledTask<"reminder"> {
  public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
    super(context, { ...options, name: "reminder" });
  }

  public override async run(payload: ReminderPayload): Promise<void> {
    const channel = await this.container.client.channels.fetch(payload.channelId).catch(() => null);

    if (!channel?.isSendable()) {
      logger.warn({ payload }, "Reminder channel unavailable; dropping reminder");
      return;
    }

    const note = payload.note ? `: **${payload.note}**` : ". No me dijiste de qué. Problema tuyo, nyaha~.";
    await channel.send(`⏰ <@${payload.userId}> ¡Me pediste que te recordara algo${note}`);
  }
}
