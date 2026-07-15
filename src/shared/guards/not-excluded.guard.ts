import { isUserExcluded } from "@core/services/user.service.js";

import { getUserErrorMessage } from "@shared/utils/error-messages.util.js";

import type { ChatInputCommandInteraction } from "discord.js";

import { Precondition } from "@sapphire/framework";

declare module "@sapphire/framework" {
  interface Preconditions {
    NotExcluded: never;
  }
}

export class NotExcludedPrecondition extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, { ...options, name: "NotExcluded" });
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      return this.ok();
    }

    return isUserExcluded(interaction.guildId, interaction.user.id)
      ? this.error({ message: getUserErrorMessage("user_excluded"), context: { code: "user_excluded" } })
      : this.ok();
  }
}
