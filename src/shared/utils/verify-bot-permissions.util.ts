import type { GuildMember, TextChannel, VoiceBasedChannel } from "discord.js";

import { PermissionFlagsBits } from "discord.js";

export function botCanSendMessagesInChannel(bot: GuildMember | undefined, channel: TextChannel): boolean {
  if (!bot) {
    return false;
  }

  if (!channel.permissionsFor(bot).has(PermissionFlagsBits.SendMessages)) {
    return false;
  }

  return true;
}

export function botCanRewriteMessages(bot: GuildMember | undefined, channel: TextChannel): boolean {
  if (!bot) {
    return false;
  }

  return channel
    .permissionsFor(bot)
    .has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.SendMessages]);
}

export function botCanSpeakInChannel(bot: GuildMember | undefined, channel: VoiceBasedChannel): boolean {
  if (!bot) {
    return false;
  }

  return channel.permissionsFor(bot).has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]);
}
