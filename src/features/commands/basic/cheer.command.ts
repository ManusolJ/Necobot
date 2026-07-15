import { pickRandom } from "@shared/utils/pick-random.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { CHEER_MESSAGES } from "@shared/consts/cheer-message. constants.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { join } from "node:path";
import { Command } from "@sapphire/framework";
import { AttachmentBuilder } from "discord.js";

const CHEER_IMAGE_PATH = join(process.cwd(), "assets", "img", "cheer.jpg");

export class CheerCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("cheer")
        .setDescription("Felicita el cumpleaños a alguien del servidor")
        .addUserOption((option) =>
          option.setName("user").setDescription("La persona que cumple años").setRequired(true),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser("user", true);

    const attachment = new AttachmentBuilder(CHEER_IMAGE_PATH, { name: "cheer.jpg" });
    const content = formatMessage(pickRandom(CHEER_MESSAGES), { user: `<@${target.id}>` });

    await interaction.reply({ content, files: [attachment] });
  }
}
