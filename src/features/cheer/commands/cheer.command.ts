import { buildCheerMessage } from "../cheer.service.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";

export class CheerCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("cheer")
        .setDescription("Felicita el cumpleaños a alguien del servidor")
        .addUserOption((option) =>
          option.setName("user").setDescription("La persona que cumple años").setRequired(true),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser("user", true);

    await interaction.reply(buildCheerMessage(`<@${target.id}>`));
  }
}
