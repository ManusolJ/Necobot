import type { GuildMember, TextChannel } from "discord.js";

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
