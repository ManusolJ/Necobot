import type { VisionResult } from "@shared/types/vision-result.type.js";

import { pickRandom } from "@shared/utils/pick-random.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { requireGuildMember } from "@shared/utils/guild-context.util.js";

import { analyzeImage } from "../vision.service.js";
import { assertSupportedImage, downloadImage } from "../image-attachment.util.js";
import { VISION_TAG_MESSAGES, VISION_UNKNOWN, VISION_FALLBACK } from "../vision.messages.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";

export class ScanCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("scan")
        .setDescription("Enseñame una imagen y te diré qué veo en ella.")
        .addAttachmentOption((option) =>
          option.setName("imagen").setDescription("La imagen que quieres que mire.").setRequired(true),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const { member } = requireGuildMember(interaction);
    const attachment = interaction.options.getAttachment("imagen", true);

    assertSupportedImage(attachment);

    await interaction.deferReply();

    const image = await downloadImage(attachment);
    if (!image) {
      await interaction.editReply(VISION_FALLBACK);
      return;
    }

    const result = await analyzeImage(image);

    await interaction.editReply({
      content: this.buildReply(result, member.displayName),
      attachments: [attachment],
    });
  }

  private buildReply(result: VisionResult, displayName: string): string {
    if (result.status === "unavailable") {
      return VISION_FALLBACK;
    }

    const messages = result.status === "tagged" ? VISION_TAG_MESSAGES[result.tagId] : VISION_UNKNOWN;

    return formatMessage(pickRandom(messages), { user: displayName });
  }
}
