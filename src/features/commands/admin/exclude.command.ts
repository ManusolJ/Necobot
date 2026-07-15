import { setUserExclusion } from "@core/services/user.service.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { MessageFlags, PermissionFlagsBits } from "discord.js";

export class ExcludeCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("exclude")
        .setDescription("Excluye a un usuario de las actividades del bot (o lo readmite)")
        .addUserOption((option) =>
          option.setName("user").setDescription("El usuario a excluir o readmitir").setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName("readmit")
            .setDescription("Pon a true para readmitir al usuario en vez de excluirlo")
            .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser("user", true);
    const readmit = interaction.options.getBoolean("readmit", false) ?? false;

    setUserExclusion(interaction.guildId!, target.id, !readmit);

    await interaction.reply({
      content: readmit
        ? `<@${target.id}> ha sido readmitido en las actividades del bot.`
        : `<@${target.id}> ha sido excluido de las actividades del bot, nyaha~.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
