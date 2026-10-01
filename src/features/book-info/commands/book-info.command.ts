import { primaryLanguage } from "../book-match.util.js";
import { findBook, buildBookEmbed } from "../book-info.service.js";
import { BOOK_NOT_FOUND, BOOK_UNAVAILABLE } from "../book-info.messages.js";
import { BOOK_QUERY_MAX_LENGTH, BOOK_DEFAULT_LANGUAGE } from "../book-info.constants.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";

export class BookInfoCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("book-info")
        .setDescription("Busco un libro y te cuento de qué va, en tu idioma si puedo")
        .addStringOption((option) =>
          option
            .setName("titulo")
            .setDescription("El título del libro")
            .setRequired(true)
            .setMaxLength(BOOK_QUERY_MAX_LENGTH),
        )
        .addStringOption((option) =>
          option
            .setName("autor")
            .setDescription("El autor, por si hay varios libros con ese título")
            .setRequired(false)
            .setMaxLength(BOOK_QUERY_MAX_LENGTH),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const title = interaction.options.getString("titulo", true).trim();
    const author = interaction.options.getString("autor")?.trim() || undefined;
    const language = primaryLanguage(interaction.locale) ?? BOOK_DEFAULT_LANGUAGE;

    await interaction.deferReply();

    const result = await findBook({ title, author, language });

    if (result.status === "found") {
      await interaction.editReply({ embeds: [buildBookEmbed(result.book, language)] });
      return;
    }

    await interaction.editReply(result.status === "not_found" ? BOOK_NOT_FOUND : BOOK_UNAVAILABLE);
  }
}
