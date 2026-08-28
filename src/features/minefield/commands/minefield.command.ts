import { armMines } from "@core/services/guild.service.js";
import { subtractPointsFromUser } from "@core/services/user.service.js";

import { requireGuildMember } from "@shared/utils/guild-context.util.js";

import { MAX_MINES_PER_PURCHASE, MINE_COST } from "../minefield.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

export class MinefieldCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("minefield")
        .setDescription(`Planta minas en el canal principal (${MINE_COST}pts por mina)`)
        .addIntegerOption((option) =>
          option
            .setName("quantity")
            .setDescription(`Cuantas minas quieres plantar (1-${MAX_MINES_PER_PURCHASE})`)
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_MINES_PER_PURCHASE),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const { guildId, member } = requireGuildMember(interaction);
    const quantity = interaction.options.getInteger("quantity", true);

    const cost = quantity * MINE_COST;
    const plural = quantity === 1 ? "" : "s";

    const charged = subtractPointsFromUser(guildId, member.id, cost);
    if (!charged) {
      await interaction.reply({
        content: `Nyaha~ ¿minas sin dinero, ${member.displayName}? Necesitas **${cost}** puntos para plantar ${quantity} mina${plural}. Vuelve cuando seas solvente.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settings = armMines(guildId, quantity);

    await interaction.reply(
      `**${quantity}** mina${plural} plantada${plural} en <#${settings.mainChannelId}>. ` +
        `Hay **${settings.activeMines}** minas activas. Te quedan **${charged.points}** puntos. Esperemos que nadie tenga mala suerte, nyaha~.`,
    );
  }
}
