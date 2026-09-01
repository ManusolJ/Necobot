import { getUserErrorMessage } from "@shared/utils/error-messages.util.js";

import type { ChatInputCommandInteraction, CommandInteractionOption } from "discord.js";

import { Precondition } from "@sapphire/framework";

declare module "@sapphire/framework" {
  interface Preconditions {
    NotABot: never;
  }
}

function hasBotTarget(options: readonly CommandInteractionOption[]): boolean {
  return options.some((option) => option.user?.bot === true || hasBotTarget(option.options ?? []));
}

export class NotABotPrecondition extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, { ...options, name: "NotABot" });
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      return this.ok();
    }

    return hasBotTarget(interaction.options.data)
      ? this.error({ message: getUserErrorMessage("target_is_bot"), context: { code: "target_is_bot" } })
      : this.ok();
  }
}
