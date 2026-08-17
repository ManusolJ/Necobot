import type { GuildMember, TextChannel, VoiceBasedChannel } from "discord.js";

import { PermissionFlagsBits } from "discord.js";

/** An unresolved bot member counts as "cannot", so callers never assume permission. */
export function botCanSendMessagesInChannel(bot: GuildMember | undefined, channel: TextChannel): boolean {
  if (!bot) {
    return false;
  }

  if (!channel.permissionsFor(bot).has(PermissionFlagsBits.SendMessages)) {
    return false;
  }

  return true;
}

/** Requires both Connect and Speak; Connect alone joins a channel it cannot use. */
export function botCanSpeakInChannel(bot: GuildMember | undefined, channel: VoiceBasedChannel): boolean {
  if (!bot) {
    return false;
  }

  return channel.permissionsFor(bot).has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]);
}
