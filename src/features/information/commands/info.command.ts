import { BOT_DISPLAY_NAME, EMBED_COLOR } from "@shared/consts/branding.constants.js";

import { INFO_EMBED_INTRO, INFO_EMBED_TITLE, INFO_COMMAND_GROUPS } from "../information.constants.js";

import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";
import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";

import { Command } from "@sapphire/framework";
import { EmbedBuilder, MessageFlags } from "discord.js";

export function buildInfoEmbed(iconUrl?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(INFO_EMBED_TITLE)
    .setDescription(INFO_EMBED_INTRO)
    .addFields(
      INFO_COMMAND_GROUPS.map((group) => ({
        name: group.name,
        value: group.commands.map((command) => `\`/${command.name}\` - ${command.description}`).join("\n"),
      })),
    )
    .setFooter({ text: BOT_DISPLAY_NAME })
    .setTimestamp();

  return iconUrl === undefined ? embed : embed.setThumbnail(iconUrl);
}

export class InfoCommand extends Command {
  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("info")
        .setDescription("Te enseño todo lo que sé hacer y para qué sirve cada comando")
        .addBooleanOption((option) =>
          option.setName("public").setDescription("Quieres que todo el mundo vea la lista?").setRequired(false),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const isPublic = interaction.options.getBoolean("public", false) ?? false;
    const embed = buildInfoEmbed(interaction.client.user.displayAvatarURL({ size: 256 }));

    const reply: InteractionReplyOptions = {
      embeds: [embed],
      ...(isPublic ? {} : { flags: MessageFlags.Ephemeral }),
    };

    await interaction.reply(reply);
  }
}
