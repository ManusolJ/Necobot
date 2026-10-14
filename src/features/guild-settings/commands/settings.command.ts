import { BotPermissionNotEnough, BotPermissionsNotVerified } from "@infrastructure/errors/domain.errors.js";

import { completeGuildSetup } from "@core/services/guild.service.js";

import { requireGuildId } from "@shared/utils/guild-context.util.js";
import { botCanSendMessagesInChannel } from "@shared/utils/verify-bot-permissions.util.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";

export class SettingsCommand extends Command {
  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("settings")
        .setDescription("Configura el bot para este servidor.")
        .addChannelOption((option) =>
          option
            .setName("main_channel")
            .setDescription("El canal que usa el bot para hablar. Puedes configurar otros canales mas tarde")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("El rol especial para seguidores del bot, usado en multiples funciones de forma opcional")
            .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const bot = await interaction.guild?.members.fetchMe();
    const roleId = interaction.options.getRole("role", false)?.id;
    const mainChannel = interaction.options.getChannel("main_channel", true, [ChannelType.GuildText]);

    if (!bot) {
      throw new BotPermissionsNotVerified();
    }

    const canSend = botCanSendMessagesInChannel(bot, mainChannel);

    if (!canSend) {
      throw new BotPermissionNotEnough(mainChannel.id);
    }

    const saved = await completeGuildSetup({
      guildId: requireGuildId(interaction),
      mainChannelId: mainChannel.id,
      specialRoleId: roleId,
    });

    await interaction.reply({
      content: `Configuración guardada. Canal principal: <#${saved.mainChannelId}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
