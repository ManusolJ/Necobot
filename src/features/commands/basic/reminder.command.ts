import type { ReminderPayload } from "@features/events/scheduled/reminder.task.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

const MAX_QUANTITY = 60;
const MAX_NOTE_LENGTH = 200;

const UNIT_MS = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
} as const satisfies Record<string, number>;

type ReminderUnit = keyof typeof UNIT_MS;

function isReminderUnit(value: string): value is ReminderUnit {
  return value in UNIT_MS;
}

export class ReminderCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("reminder")
        .setDescription("Te aviso con una mención cuando pase el tiempo que elijas")
        .addStringOption((option) =>
          option
            .setName("unit")
            .setDescription("Unidad de tiempo")
            .setRequired(true)
            .addChoices(
              { name: "Minutos", value: "minutes" satisfies ReminderUnit },
              { name: "Horas", value: "hours" satisfies ReminderUnit },
              { name: "Días", value: "days" satisfies ReminderUnit },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName("quantity")
            .setDescription(`Cuantas unidades (1-${MAX_QUANTITY})`)
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_QUANTITY),
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Qué quieres que te recuerde")
            .setRequired(false)
            .setMaxLength(MAX_NOTE_LENGTH),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const unit = interaction.options.getString("unit", true);
    const quantity = interaction.options.getInteger("quantity", true);
    const note = interaction.options.getString("message", false);

    const delay = quantity * UNIT_MS[isReminderUnit(unit) ? unit : "minutes"];
    const firesAt = Math.floor((Date.now() + delay) / 1000);

    const payload: ReminderPayload = {
      channelId: interaction.channelId,
      userId: interaction.user.id,
      note: note ?? null,
    };

    await this.container.tasks.create({ name: "reminder", payload }, { repeated: false, delay });

    await interaction.reply({
      content: `⏰ Hecho. Te aviso <t:${firesAt}:R> (<t:${firesAt}:f>).${note ? ` Recordatorio: **${note}**` : ""}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
