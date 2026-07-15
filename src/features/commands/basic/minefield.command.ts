import { GuildMemberNotFound } from "@infrastructure/errors/discord.errors.js";

import { subtractPointsFromUser } from "@core/services/user.service.js";
import { armMines, getGuildSettings } from "@core/services/guild.service.js";

import { MAX_MINES_PER_PURCHASE, MINE_COST } from "@shared/consts/minefield.constants.js";

import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
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
    const guildId = interaction.guildId!;
    const member = interaction.member as GuildMember | null;
    const quantity = interaction.options.getInteger("quantity", true);

    if (!member) {
      throw new GuildMemberNotFound(guildId);
    }

    const cost = quantity * MINE_COST;

    const charged = subtractPointsFromUser(guildId, member.id, cost);
    if (!charged) {
      await interaction.reply({
        content: `Nyaha~ ¿minas sin dinero, ${member.displayName}? Necesitas **${cost}** puntos para plantar ${quantity} mina${quantity === 1 ? "" : "s"}. Vuelve cuando seas solvente.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settings = armMines(guildId, quantity);
    const mainChannel = getGuildSettings(guildId)?.mainChannelId ?? settings.mainChannelId;

    await interaction.reply(
      `**${quantity}** mina${quantity === 1 ? "" : "s"} plantada${quantity === 1 ? "" : "s"} en <#${mainChannel}>. ` +
        `Hay **${settings.activeMines}** minas activas. Te quedan **${charged.points}** puntos. Esperemos que nadie tenga mala suerte, nyaha~.`,
    );
  }
}
