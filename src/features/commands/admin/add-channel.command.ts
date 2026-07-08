import { BotPermissionNotEnough, BotPermissionsNotVerified } from "@infrastructure/errors/domain.errors.js";

import { registerGuildChannel } from "@core/services/guild.service.js";

import { CHANNEL_PURPOSES } from "@shared/consts/settings.constants.js";
import { botCanSendMessagesInChannel } from "@shared/utils/verify-bot-permissions.util.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";

export class AddChannelCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("add-channel")
        .setDescription("Añade un canal adicional para el bot, usado como medio alternativo para algunas funciones")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("El canal de tu servidor que quieres añadir")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option
            .setName("purpose")
            .setDescription("La funcion que tendra el canal añadido")
            .setRequired(true)
            .addChoices(CHANNEL_PURPOSES),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const bot = await interaction.guild?.members.fetchMe();
    const purpose = interaction.options.getString("purpose", true);
    const channel = interaction.options.getChannel("channel", true, [ChannelType.GuildText]);

    if (!bot) {
      throw new BotPermissionsNotVerified();
    }

    if (!botCanSendMessagesInChannel(bot, channel)) {
      throw new BotPermissionNotEnough(channel.id);
    }

    const saved = registerGuildChannel({
      guildId: interaction.guildId!,
      channelId: channel.id,
      purpose,
    });

    let label = "";

    for (const purpose of CHANNEL_PURPOSES) {
      if (purpose.value === saved.purpose) {
        label = purpose.name;
      }
    }

    await interaction.reply({
      content: `Canal registrado: <#${saved.channelId}> como **${label.length === 0 ? label : saved.purpose}**.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
