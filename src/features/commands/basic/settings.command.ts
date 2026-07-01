import { completeGuildSetup } from "@core/services/guild.service.js";

import { ChannelType, MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";

import { Command, type ApplicationCommandRegistry, type Awaitable } from "@sapphire/framework";

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
            .setDescription("El prefijo para uso de comandos legacy (Predeterminado: !).")
            .setRequired(false)
            .addChoices(
              { name: "!", value: "!" },
              { name: "?", value: "?" },
              { name: ">", value: ">" },
              { name: ".", value: "." },
            ),
        )
        .addRoleOption((option) =>
          option.setName("role").setDescription("El rol especial para seguidores del bot").setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    const mainChannel = interaction.options.getChannel("main_channel", true, [ChannelType.GuildText]);
    const prefix = interaction.options.getString("prefix", false);
    const roleId = interaction.options.getRole("role", false)?.id ?? null;
    const bot = await interaction.guild?.members.fetchMe();

    if (!bot) {
      return interaction.reply({
        content: "No pude verificar mis permisos en este servidor.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const canSend = mainChannel.permissionsFor(bot)?.has(PermissionFlagsBits.SendMessages) ?? false;

    if (!canSend) {
      return interaction.reply({
        content: "No tengo permisos suficientes para mandar mensajes en este canal.",
        flags: MessageFlags.Ephemeral,
      });
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
