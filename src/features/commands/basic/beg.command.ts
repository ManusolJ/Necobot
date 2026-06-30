import { awardPoints } from "@core/services/user.service.js";
import type { ApplicationCommandRegistry, Awaitable, ChatInputCommand } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import type { AwardInput } from "@shared/interfaces/award-input.interface.js";
import { pointGenerator } from "@shared/utils/point-generator.util.js";
import type { ChatInputCommandInteraction } from "discord.js";

const MINIMUM_REWARD = 1;
const MAXIMUM_REWARD = 100;

//TODO: Add chance to fail the beg
//TODO: Add chance to retry the beg based on rol
//TODO: Add multiple message for both fail and success
export class BegCommand extends Command {
  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder.setName("beg").setDescription("Pideme puntos como el vagabundo que eres."),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    const amount = pointGenerator(MINIMUM_REWARD, MAXIMUM_REWARD);

    const reward: AwardInput = {
      userId,
      guildId,
      amount,
      action: "beg",
    };

    awardPoints(reward);

    await interaction.reply(`Vaya! Felicidades has conseguido ${amount} puntos! No lo gastes todo de golpe!`);
  }
}
