import { getGuildUser, recordDrink } from "@core/services/user.service.js";

import type { VisionResult } from "@shared/types/vision-result.type.js";

import { randomInt } from "@shared/utils/random-int.util.js";
import { pickRandom } from "@shared/utils/pick-random.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { requireGuildMember } from "@shared/utils/guild-context.util.js";
import { isFriday, isSameCalendarDay } from "@shared/utils/calendar.util.js";

import { analyzeImage } from "../vision.service.js";
import { VISION_FALLBACK } from "../vision.messages.js";
import { assertSupportedImage, downloadImage } from "../image-attachment.util.js";
import { MAX_POINTS_CHANGE_PER_DRINK, MIN_POINTS_CHANGE_PER_DRINK } from "../monster.constants.js";
import { FRIDAY_MONSTER, IS_NOT_FRIDAY, MONSTER_COOLDOWN, NOT_A_MONSTER } from "../monster.messages.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { Command } from "@sapphire/framework";
import { AttachmentBuilder, MessageFlags } from "discord.js";

export class MonsterTimeCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("monster-time")
        .setDescription("Enseñame un monster un viernes y te dare una recompensa (mas te vale que sea viernes)")
        .addAttachmentOption((option) =>
          option.setName("monster").setDescription("Tu precioso monstruo").setRequired(true),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const { guildId, member } = requireGuildMember(interaction);
    const attachment = interaction.options.getAttachment("monster", true);

    assertSupportedImage(attachment);

    const user = getGuildUser(guildId, member.id);

    if (user?.lastDrinkedAt && isSameCalendarDay(user.lastDrinkedAt, new Date())) {
      await interaction.reply({
        content: formatMessage(pickRandom(MONSTER_COOLDOWN), { user: member.displayName }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const image = await downloadImage(attachment);

    if (!image) {
      await interaction.editReply(VISION_FALLBACK);
      return;
    }

    const file = new AttachmentBuilder(Buffer.from(await image.arrayBuffer()), { name: attachment.name });

    const result = await analyzeImage(image);

    if (result.status === "unavailable") {
      await interaction.editReply({ content: VISION_FALLBACK, files: [file] });
      return;
    }

    if (!this.isMonster(result)) {
      await interaction.editReply({
        content: formatMessage(pickRandom(NOT_A_MONSTER), { user: member.displayName }),
        files: [file],
      });
      return;
    }

    const friday = isFriday();
    const amount = randomInt(MIN_POINTS_CHANGE_PER_DRINK, MAX_POINTS_CHANGE_PER_DRINK);
    const pointsDelta = friday ? amount : -amount;

    recordDrink(guildId, member.id, pointsDelta);

    await interaction.editReply({
      content: this.buildReply(member.displayName, amount, friday),
      files: [file],
    });
  }

  private isMonster(result: VisionResult): boolean {
    return result.status === "tagged" && result.tagId === "energy_drink";
  }

  private buildReply(displayName: string, points: number, friday: boolean): string {
    const messages = friday ? FRIDAY_MONSTER : IS_NOT_FRIDAY;

    return formatMessage(pickRandom(messages), { user: displayName, points });
  }
}
