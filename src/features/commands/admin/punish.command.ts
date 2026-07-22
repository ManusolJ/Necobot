import { confiscatePointsPercent } from "@core/services/user.service.js";

import type { ChatInputCommandInteraction, User } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { MessageFlags, PermissionFlagsBits } from "discord.js";

const PUNISH_PERCENT = 0.5;

export class PunishCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("punish")
        .setDescription(`Confisca el ${PUNISH_PERCENT * 100}% de los puntos de los usuarios elegidos`)
        .addUserOption((option) => option.setName("user").setDescription("El usuario a castigar").setRequired(true))
        .addUserOption((option) => option.setName("user2").setDescription("Otro usuario a castigar").setRequired(false))
        .addUserOption((option) =>
          option.setName("user3").setDescription("Otro usuario más a castigar").setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;

    const targets = [
      interaction.options.getUser("user", true),
      interaction.options.getUser("user2", false),
      interaction.options.getUser("user3", false),
    ].filter((user, index, all): user is User => user !== null && all.findIndex((u) => u?.id === user.id) === index);

    const lines: string[] = [];

    for (const target of targets) {
      if (target.bot) {
        lines.push(`<@${target.id}> es un bot. Los bots somos intocables, nyaha~.`);
        continue;
      }

      const result = confiscatePointsPercent(guildId, target.id, PUNISH_PERCENT);

      lines.push(
        result
          ? `<@${target.id}> pierde **${result.taken}** puntos. Le quedan **${result.user.points}**. La justicia es implacable.`
          : `<@${target.id}> no tiene nada que confiscar. Castigar a la pobreza sería redundante.`,
      );
    }

    if (lines.length === 0) {
      await interaction.reply({ content: "No hay nadie a quien castigar.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply(`⚖️ **Castigo divino ejecutado:**\n${lines.join("\n")}`);
  }
}
