import { setUserBirthday } from "@core/services/user.service.js";

import { formatMessage } from "@shared/utils/format-message.util.js";
import { requireGuildMember } from "@shared/utils/guild-context.util.js";

import { BIRTHDAY_WARNING_DAYS } from "../birthday.constants.js";
import { formatBirthday, isLeapDay, parseBirthday } from "../birthday.service.js";
import { BIRTHDAY_SAVED, BIRTHDAY_INVALID_DATE, BIRTHDAY_SAVED_LEAP_NOTE } from "../birthday.messages.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

export class BirthdayCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("birthday")
        .setDescription("Dime tu cumpleaños para avisar a los demas y conseguir un regalito")
        .addStringOption((option) =>
          option.setName("date").setDescription("La fecha en este formato: 09/12 (DD/MM)").setRequired(true),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const { guildId, member } = requireGuildMember(interaction);

    const rawDate = interaction.options.getString("date", true);
    const birthday = parseBirthday(rawDate);

    if (!birthday) {
      await interaction.reply({
        content: formatMessage(BIRTHDAY_INVALID_DATE, { date: rawDate }),
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    setUserBirthday(guildId, member.id, birthday);

    const saved = formatMessage(BIRTHDAY_SAVED, {
      date: formatBirthday(birthday),
      days: String(BIRTHDAY_WARNING_DAYS),
    });

    await interaction.reply({
      content: isLeapDay(birthday) ? `${saved}\n\n${BIRTHDAY_SAVED_LEAP_NOTE}` : saved,
      flags: MessageFlags.Ephemeral,
    });
  }
}
