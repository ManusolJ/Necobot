import { GuildMemberNotFound } from "@infrastructure/errors/discord.errors.js";

import type { ChatInputCommandInteraction } from "discord.js";

import { GuildMember } from "discord.js";

const UNKNOWN_GUILD = "unknown";

export function requireGuildId(interaction: ChatInputCommandInteraction): string {
  if (interaction.guildId === null) {
    throw new GuildMemberNotFound(UNKNOWN_GUILD);
  }

  return interaction.guildId;
}

export function requireGuildMember(interaction: ChatInputCommandInteraction): {
  guildId: string;
  member: GuildMember;
} {
  const guildId = requireGuildId(interaction);

  if (!(interaction.member instanceof GuildMember)) {
    throw new GuildMemberNotFound(guildId);
  }

  return { guildId, member: interaction.member };
}
