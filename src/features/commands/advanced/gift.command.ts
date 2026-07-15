import { logger } from "@infrastructure/config/logger.config.js";
import { GuildMemberNotFound } from "@infrastructure/errors/discord.errors.js";

import { isUserExcluded, subtractPointsFromUser, sumPointsToUser } from "@core/services/user.service.js";

import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

export class GiftCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("gift")
        .setDescription("Regala puntos a otro usuario del servidor")
        .addUserOption((option) => option.setName("user").setDescription("Quien recibe tus puntos").setRequired(true))
        .addIntegerOption((option) =>
          option.setName("amount").setDescription("Cuantos puntos regalas").setRequired(true).setMinValue(1),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const member = interaction.member as GuildMember | null;
    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (!member) {
      throw new GuildMemberNotFound(guildId);
    }

    if (target.bot) {
      await interaction.reply({
        content: "Los bots no necesitamos tu caridad, nyaha~. Regálaselo a un humano.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (target.id === member.id) {
      await interaction.reply({
        content: "¿Regalarte puntos a ti mismo? Eso no es un regalo, es contabilidad creativa. No.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (isUserExcluded(guildId, target.id)) {
      await interaction.reply({
        content: `<@${target.id}> está excluido de las actividades del bot. No acepto transferencias a cuentas congeladas.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const charged = subtractPointsFromUser(guildId, member.id, amount);
    if (!charged) {
      await interaction.reply({
        content: `Nyaha~ ¿regalando **${amount}** puntos sin tenerlos, ${member.displayName}? La generosidad de los pobres me conmueve, pero no.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      sumPointsToUser(guildId, target.id, amount);
    } catch (error) {
      logger.error({ err: error, guildId, from: member.id, to: target.id, amount }, "Gift transfer failed; refunding");
      sumPointsToUser(guildId, member.id, amount);
      throw error;
    }

    await interaction.reply(
      `🎁 <@${member.id}> le ha regalado **${amount}** puntos a <@${target.id}>. Le quedan **${charged.points}**. Qué bonito. Qué sospechoso.`,
    );
  }
}
