import { logger } from "@infrastructure/config/logger.config.js";

import { fetchGlobalCommands, fetchGuildCommands, purgeGuildCommands, syncGlobalsToGuild } from "../deploy.service.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

const GUILD_OPTION = "guild";
const GUILD_OPTION_DESCRIPTION = "ID del servidor (por defecto, este)";

export class DeployCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["OwnerOnly"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("deploy")
        .setDescription("Gestiona el registro de comandos (solo dueño)")
        .addSubcommand((sub) =>
          sub
            .setName("status")
            .setDescription("Muestra qué comandos hay en cada ámbito y cuáles están huérfanos")
            .addStringOption((option) => option.setName(GUILD_OPTION).setDescription(GUILD_OPTION_DESCRIPTION)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("sync")
            .setDescription("Copia los comandos globales a un servidor para que aparezcan al instante")
            .addStringOption((option) => option.setName(GUILD_OPTION).setDescription(GUILD_OPTION_DESCRIPTION)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("purge")
            .setDescription("Borra los comandos locales de un servidor (deja solo los globales)")
            .addStringOption((option) => option.setName(GUILD_OPTION).setDescription(GUILD_OPTION_DESCRIPTION)),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.options.getString(GUILD_OPTION) ?? interaction.guildId;

    if (guildId === null) {
      await interaction.reply({
        content: "Usa este comando en un servidor, o pasa el ID con la opción `guild`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.editReply(await this.runSubcommand(interaction, subcommand, guildId));
    } catch (error) {
      logger.error({ err: error, subcommand, guildId }, "Deploy command failed");
      await interaction.editReply(
        "La llamada a la API de Discord falló. Comprueba que el ID del servidor es correcto y que estoy en él.",
      );
    }
  }

  private async runSubcommand(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
    guildId: string,
  ): Promise<string> {
    switch (subcommand) {
      case "status":
        return this.status(interaction, guildId);
      case "sync":
        return this.sync(interaction, guildId);
      case "purge":
        return this.purge(interaction, guildId);
      default:
        return `Subcomando desconocido: ${subcommand}`;
    }
  }

  private knownCommandNames(): Set<string> {
    const names = new Set<string>();

    for (const command of this.container.stores.get("commands").values()) {
      for (const nameOrId of command.applicationCommandRegistry.chatInputCommands) {
        names.add(nameOrId);
      }
    }

    return names;
  }

  private async status(interaction: ChatInputCommandInteraction, guildId: string): Promise<string> {
    const [global, guild] = await Promise.all([
      fetchGlobalCommands(interaction.client),
      fetchGuildCommands(interaction.client, guildId),
    ]);

    const known = this.knownCommandNames();
    const globalNames = global.map((command) => command.name);
    const guildNames = guild.map((command) => command.name);

    const orphans = [...new Set([...globalNames, ...guildNames])].filter((name) => !known.has(name));
    const inBoth = guildNames.filter((name) => globalNames.includes(name));

    const lines = [
      `**Servidor:** \`${guildId}\``,
      `**Globales (${global.length}):** ${this.format(globalNames)}`,
      `**Locales (${guild.length}):** ${this.format(guildNames)}`,
    ];

    lines.push(
      orphans.length > 0
        ? `\n **Huérfanos:** ${this.format(orphans)}\nEstán registrados en Discord pero no tienen ninguna pieza detrás. Son los que aparecen y nunca responden. Si son locales, \`/deploy purge\` los borra.`
        : "\n Todos los comandos registrados tienen una pieza detrás.",
    );

    if (inBoth.length > 0) {
      lines.push(
        `\nℹ️ En ambos ámbitos: ${this.format(inBoth)}\nSalen duplicados en el selector, pero **los dos responden**: Sapphire resuelve por nombre además de por ID. \`/deploy purge\` deja solo los globales.`,
      );
    }

    return lines.join("\n");
  }

  private async sync(interaction: ChatInputCommandInteraction, guildId: string): Promise<string> {
    const names = await syncGlobalsToGuild(interaction.client, guildId);

    logger.info({ guildId, count: names.length }, "Synced global commands to guild");

    return [
      `Copiados **${names.length}** comandos globales a \`${guildId}\`. Aparecen al instante.`,
      "",
      "Ahora están en ambos ámbitos, así que puede que los veas duplicados. Los dos responden; `/deploy purge` quita las copias locales.",
    ].join("\n");
  }

  private async purge(interaction: ChatInputCommandInteraction, guildId: string): Promise<string> {
    const names = await purgeGuildCommands(interaction.client, guildId);

    if (names.length === 0) {
      return `El servidor \`${guildId}\` no tiene comandos locales. No hay nada que borrar.`;
    }

    logger.info({ guildId, count: names.length }, "Purged guild commands");

    return [
      `Borrados **${names.length}** comandos locales de \`${guildId}\`: ${this.format(names)}`,
      "",
      "Los globales siguen intactos. El cliente puede tardar un momento en refrescarse.",
    ].join("\n");
  }

  private format(names: string[]): string {
    return names.length === 0
      ? "_(ninguno)_"
      : [...names]
          .sort()
          .map((name) => `\`${name}\``)
          .join(", ");
  }
}
