import { confiscatePointsPercent } from "@core/services/user.service.js";

import { requireGuildId } from "@shared/utils/guild-context.util.js";

import { PUNISH_PERCENT } from "../moderation.constants.js";

import type { ChatInputCommandInteraction, User } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { MessageFlags, PermissionFlagsBits } from "discord.js";

const TARGET_OPTIONS = [
  { name: "user", description: "El usuario a castigar", required: true },
  { name: "user2", description: "Otro usuario a castigar", required: false },
  { name: "user3", description: "Otro usuario más a castigar", required: false },
] as const;

export class PunishCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) => {
      builder
        .setName("punish")
        .setDescription(`Confisca el ${PUNISH_PERCENT * 100}% de los puntos de los usuarios elegidos`)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

      for (const target of TARGET_OPTIONS) {
        builder.addUserOption((option) =>
          option.setName(target.name).setDescription(target.description).setRequired(target.required),
        );
      }

      return builder;
    });
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = requireGuildId(interaction);

    const selected = TARGET_OPTIONS.map((target) => interaction.options.getUser(target.name, false));
    const targets = selected.filter(
      (user, index): user is User => user !== null && selected.findIndex((other) => other?.id === user.id) === index,
    );

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

    await interaction.reply(`**Castigo divino ejecutado:**\n${lines.join("\n")}`);
  }
}
