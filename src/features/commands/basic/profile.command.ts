import { GuildMemberNotFound } from "@infrastructure/errors/discord.errors.js";

import { getGuildUser } from "@core/services/user.service.js";

import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { EmbedBuilder } from "discord.js";
import { Command } from "@sapphire/framework";

const EMBED_COLOR = 0xeb459e;

export class ProfileCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder.setName("profile").setDescription("Muestra tu perfil con todas tus estadisticas del servidor"),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember | null;

    if (!member) {
      throw new GuildMemberNotFound(interaction.guildId!);
    }

    const user = getGuildUser(interaction.guildId!, member.id);

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .setTitle("Perfil del servidor")
      .addFields(
        { name: "Puntos", value: String(user?.points ?? 0), inline: true },
        { name: "Puntos históricos", value: String(user?.historicalPoints ?? 0), inline: true },
        { name: "​", value: "​", inline: true },
        { name: "Veces mendigado", value: String(user?.timesBegged ?? 0), inline: true },
        { name: "Minas pisadas", value: String(user?.activatedMines ?? 0), inline: true },
        { name: "Trivias ganadas", value: String(user?.triviaWins ?? 0), inline: true },
      )
      .setFooter({ text: "necobot-ultimus" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
