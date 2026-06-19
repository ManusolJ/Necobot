import { env } from "@infrastructure/config/env.config.js";

import type { ChatInputCommandInteraction } from "discord.js";

import type {
  Awaitable,
  ApplicationCommandRegistry,
} from "@sapphire/framework";
import { Command } from "@sapphire/framework";

const options = env.DISCORD_DEV_GUILD_ID
  ? { guildIds: [env.DISCORD_DEV_GUILD_ID] }
  : undefined;

export class PingCommand extends Command {
  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry,
  ): Awaitable<void> {
    registry.registerChatInputCommand(
      (builder) =>
        builder.setName("ping").setDescription("Replies with Pong (TEST)."),
      options,
    );
  }

  public override async chatInputRun(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.reply("Pong!");
  }
}
