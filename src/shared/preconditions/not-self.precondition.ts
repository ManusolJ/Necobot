import { getUserErrorMessage } from "@shared/utils/error-messages.util.js";

import type { ChatInputCommandInteraction, CommandInteractionOption } from "discord.js";

import { Precondition } from "@sapphire/framework";

declare module "@sapphire/framework" {
  interface Preconditions {
    NotSelf: never;
  }
}

function hasSelfTarget(options: readonly CommandInteractionOption[], callerId: string): boolean {
  return options.some((option) => option.user?.id === callerId || hasSelfTarget(option.options ?? [], callerId));
}

export class NotSelfPrecondition extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, { ...options, name: "NotSelf" });
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      return this.ok();
    }

    return hasSelfTarget(interaction.options.data, interaction.user.id)
      ? this.error({ message: getUserErrorMessage("target_is_self"), context: { code: "target_is_self" } })
      : this.ok();
  }
}
