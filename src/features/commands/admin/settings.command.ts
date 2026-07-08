import { completeGuildSetup } from "@core/services/guild.service.js";

import { AVAILABLE_PREFIXES } from "@shared/consts/settings.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { botCanSendMessagesInChannel } from "@shared/utils/verify-bot-permissions.util.js";
import { BotPermissionNotEnough } from "@infrastructure/errors/domain.errors.js";

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
        .addStringOption((option) =>
          option
            .setName("prefix")
            .setDescription("El prefijo para uso de comandos legacy (Predeterminado: !)")
            .setRequired(false)
            .addChoices(AVAILABLE_PREFIXES),
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
    const prefix = interaction.options.getString("prefix", false);
    const roleId = interaction.options.getRole("role", false)?.id ?? null;
    const mainChannel = interaction.options.getChannel("main_channel", true, [ChannelType.GuildText]);

    if (!bot) {
      interaction.reply({
        content: "No pude verificar mis permisos en este servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const canSend = botCanSendMessagesInChannel(bot, mainChannel);

    if (!canSend) {
      throw new BotPermissionNotEnough(mainChannel.id);
    }

    const saved = completeGuildSetup({
      guildId: interaction.guildId!,
      mainChannelId: mainChannel.id,
      prefix: prefix ?? undefined,
      begRetryRoleId: roleId,
    });

    await interaction.reply({
      content: `Configuración guardada. Canal principal: <#${saved.mainChannelId}>, prefijo: \`${saved.prefix}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
