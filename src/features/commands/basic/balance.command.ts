import { getGuildUser } from "@core/services/user.service.js";

import { requireGuildMember } from "@shared/utils/guild-context.util.js";

import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";
import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

export class BalanceCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("balance")
        .setDescription("Comprueba cuantos puntos tienes actualmente")
        .addBooleanOption((option) =>
          option
            .setName("public")
            .setDescription("Quieres que todo el mundo pueda ver tus tristes puntos?")
            .setRequired(false),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const isPublic = interaction.options.getBoolean("public", false) ?? false;
    const { guildId, member } = requireGuildMember(interaction);

    const user = getGuildUser(guildId, member.id);
    const points = user?.points ?? 0;

    const reply: InteractionReplyOptions = {
      content:
        points > 0
          ? `Tienes **${points}** puntos, ${member.displayName}. Gástalos sabiamente... o no, más contenido para mí.`
          : `Tienes **${points}** puntos, ${member.displayName}. Nyaha~ la pobreza también es un estilo de vida.`,
      ...(isPublic ? {} : { flags: MessageFlags.Ephemeral }),
    };

    await interaction.reply(reply);
  }
}
