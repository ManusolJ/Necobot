import { randomInt } from "@shared/utils/random-int.util.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";

const MIN_DICE = 1;
const MAX_DICE = 20;
const MIN_SIDES = 2;
const MAX_SIDES = 1000;

export class RollCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("roll")
        .setDescription("Tira un dado de tu eleccion")
        .addIntegerOption((option) =>
          option
            .setName("sides")
            .setDescription(`Numero de caras del dado (${MIN_SIDES}-${MAX_SIDES})`)
            .setRequired(true)
            .setMinValue(MIN_SIDES)
            .setMaxValue(MAX_SIDES),
        )
        .addIntegerOption((option) =>
          option
            .setName("quantity")
            .setDescription(`Numero de dados a tirar (${MIN_DICE}-${MAX_DICE})`)
            .setRequired(true)
            .setMinValue(MIN_DICE)
            .setMaxValue(MAX_DICE),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const sides = interaction.options.getInteger("sides", true);
    const numberOfDice = interaction.options.getInteger("quantity", true);

    const results = Array.from({ length: numberOfDice }, () => randomInt(1, sides));

    if (results.length === 1) {
      await interaction.reply(`El resultado de la tirada es: **${results[0]}**`);
      return;
    }

    const total = results.reduce((sum, roll) => sum + roll, 0);
    const lines = results.map((roll, index) => `Tirada ${index + 1}: **${roll}**`);

    await interaction.reply(["Estos son los resultados:", ...lines, `En total: **${total}**`].join("\n"));
  }
}
