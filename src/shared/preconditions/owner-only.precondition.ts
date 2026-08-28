import { env } from "@infrastructure/config/env.config.js";

import type { ChatInputCommandInteraction } from "discord.js";

import { Precondition } from "@sapphire/framework";

declare module "@sapphire/framework" {
  interface Preconditions {
    OwnerOnly: never;
  }
}

export class OwnerOnlyPrecondition extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, { ...options, name: "OwnerOnly" });
  }

  public override chatInputRun(interaction: ChatInputCommandInteraction) {
    if (env.BOT_OWNER_ID === undefined) {
      return this.error({
        message: "Este comando requiere configurar BOT_OWNER_ID.",
        context: { code: "owner_not_configured" },
      });
    }

    return interaction.user.id === env.BOT_OWNER_ID
      ? this.ok()
      : this.error({ message: "Este comando es solo para mi dueño, nyaha~.", context: { code: "not_owner" } });
  }
}
