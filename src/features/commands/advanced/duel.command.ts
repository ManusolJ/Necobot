import { logger } from "@infrastructure/config/logger.config.js";
import { GuildMemberNotFound } from "@infrastructure/errors/discord.errors.js";

import { getGuildSettings } from "@core/services/guild.service.js";
import { getGuildUser, isUserExcluded, subtractPointsFromUser, sumPointsToUser } from "@core/services/user.service.js";

import type { RpsChoice } from "@shared/types/rps-choice.type.js";

import { pickRandom } from "@shared/utils/pick-random.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import {
  DUEL_MAX_BET,
  DUEL_DEFAULT_BET,
  DUEL_VS_BOT_REWARD,
  DUEL_PHASE_TIMEOUT_MS,
} from "@shared/consts/duel.constants.js";
import {
  DUEL_WIN,
  DUEL_DRAW,
  DUEL_DENIED,
  DUEL_BOT_WIN,
  DUEL_BOT_DRAW,
  DUEL_BOT_LOSE,
  DUEL_NOT_FOR_YOU,
  DUEL_BOT_TIMEOUT,
  DUEL_TARGET_BROKE,
  DUEL_ALREADY_CHOSE,
  DUEL_NO_CHOICE_ONE,
  DUEL_NO_CHOICE_BOTH,
  DUEL_INVITE_TIMEOUT,
  DUEL_CHOICE_REGISTERED,
} from "@shared/consts/duel-message.constants.js";

import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";
import type { ButtonInteraction, ChatInputCommandInteraction, GuildMember, Message, User } from "discord.js";

import { Command } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags } from "discord.js";

const EMBED_COLOR = 0xeb459e;

const BEATS: Record<RpsChoice, RpsChoice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

const CHOICE_LABEL: Record<RpsChoice, string> = {
  rock: "🪨 Piedra",
  paper: "📄 Papel",
  scissors: "✂️ Tijeras",
};

const RPS_CHOICES: readonly RpsChoice[] = ["rock", "paper", "scissors"];

function buildRpsRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("duel-rock").setLabel("Piedra").setEmoji("🪨").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("duel-paper").setLabel("Papel").setEmoji("📄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("duel-scissors").setLabel("Tijeras").setEmoji("✂️").setStyle(ButtonStyle.Secondary),
  );
}

function customIdToChoice(customId: string): RpsChoice | undefined {
  return RPS_CHOICES.find((choice) => customId === `duel-${choice}`);
}

export class DuelCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("duel")
        .setDescription("Reta a alguien (o a mí) a piedra, papel o tijeras")
        .addUserOption((option) =>
          option
            .setName("opponent")
            .setDescription("A quien retas. Si no eliges a nadie, juegas contra mí")
            .setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName("bet")
            .setDescription(`Puntos en juego contra otro usuario (predeterminado: ${DUEL_DEFAULT_BET})`)
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(DUEL_MAX_BET),
        ),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const member = interaction.member as GuildMember | null;
    const opponent = interaction.options.getUser("opponent", false);
    const bet = interaction.options.getInteger("bet", false) ?? DUEL_DEFAULT_BET;

    if (!member) {
      throw new GuildMemberNotFound(guildId);
    }

    if (!opponent || opponent.id === this.container.client.user?.id) {
      await this.runVersusBot(interaction, member);
      return;
    }

    await this.runVersusUser(interaction, member, opponent, bet);
  }

  private async runVersusBot(interaction: ChatInputCommandInteraction, member: GuildMember): Promise<void> {
    const guildId = interaction.guildId!;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("Duelo contra la criatura")
      .setDescription(`<@${member.id}> me reta a piedra, papel o tijeras. Elige tu arma. Tienes 5 minutos.`);

    await interaction.reply({ embeds: [embed], components: [buildRpsRow()] });
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: DUEL_PHASE_TIMEOUT_MS,
    });

    collector.on("collect", (button: ButtonInteraction) => {
      void (async () => {
        try {
          if (button.user.id !== member.id) {
            await button.reply({ content: DUEL_NOT_FOR_YOU, flags: MessageFlags.Ephemeral });
            return;
          }

          const userChoice = customIdToChoice(button.customId);
          if (!userChoice) {
            return;
          }

          const botChoice = pickRandom(RPS_CHOICES);
          const replacements = {
            user: `<@${member.id}>`,
            userChoice: CHOICE_LABEL[userChoice],
            botChoice: CHOICE_LABEL[botChoice],
            reward: DUEL_VS_BOT_REWARD,
          };

          let resultText: string;
          if (userChoice === botChoice) {
            resultText = formatMessage(pickRandom(DUEL_BOT_DRAW), replacements);
          } else if (BEATS[userChoice] === botChoice) {
            sumPointsToUser(guildId, member.id, DUEL_VS_BOT_REWARD);
            resultText = formatMessage(pickRandom(DUEL_BOT_WIN), replacements);
          } else {
            resultText = formatMessage(pickRandom(DUEL_BOT_LOSE), replacements);
          }

          await button.update({
            embeds: [EmbedBuilder.from(embed).setDescription(resultText)],
            components: [],
          });
          collector.stop("handled");
        } catch (error) {
          logger.error({ err: error, guildId }, "Duel vs bot failed");
        }
      })();
    });

    collector.on("end", (_collected, reason) => {
      if (reason === "handled") {
        return;
      }
      void interaction
        .editReply({
          embeds: [
            EmbedBuilder.from(embed).setDescription(
              formatMessage(pickRandom(DUEL_BOT_TIMEOUT), { user: `<@${member.id}>` }),
            ),
          ],
          components: [],
        })
        .catch((error: unknown) => logger.warn({ err: error }, "Failed to edit expired bot duel"));
    });
  }

  private async runVersusUser(
    interaction: ChatInputCommandInteraction,
    challenger: GuildMember,
    target: User,
    bet: number,
  ): Promise<void> {
    const guildId = interaction.guildId!;

    if (target.bot) {
      await interaction.reply({
        content: "Para retar a un bot, déjame el campo vacío y pelea conmigo, nyaha~.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (target.id === challenger.id) {
      await interaction.reply({
        content: "¿Un duelo contra ti mismo? Busca ayuda. O un rival.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (isUserExcluded(guildId, target.id)) {
      await interaction.reply({
        content: `<@${target.id}> está excluido de las actividades del bot. No se puede duelar con fantasmas.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetPoints = getGuildUser(guildId, target.id)?.points ?? 0;
    if (targetPoints < bet) {
      await interaction.reply(
        formatMessage(pickRandom(DUEL_TARGET_BROKE), {
          target: `<@${target.id}>`,
          challenger: `<@${challenger.id}>`,
          bet,
        }),
      );
      return;
    }

    const charged = subtractPointsFromUser(guildId, challenger.id, bet);
    if (!charged) {
      await interaction.reply(
        `Nyaha~ ¿retando a duelos de **${bet}** puntos sin tenerlos, <@${challenger.id}>? La confianza de los arruinados es admirable. Cancelado.`,
      );
      return;
    }

    const mainChannelId = getGuildSettings(guildId)?.mainChannelId;
    const mainChannel = mainChannelId
      ? await this.container.client.channels.fetch(mainChannelId).catch(() => null)
      : null;

    if (!mainChannel?.isSendable()) {
      sumPointsToUser(guildId, challenger.id, bet);
      await interaction.reply({
        content: "No pude acceder al canal principal para enviar la invitación. Puntos devueltos.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const inviteEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("⚔️ ¡Invitación a duelo!")
      .setDescription(
        `<@${challenger.id}> reta a <@${target.id}> a piedra, papel o tijeras por **${bet}** puntos.\n\n` +
          `<@${target.id}>, ¿aceptas? Tienes 5 minutos antes de que esto se convierta en una humillación pública.`,
      );

    const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("duel-accept").setLabel("Aceptar").setEmoji("⚔️").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("duel-deny").setLabel("Rechazar").setEmoji("🏳️").setStyle(ButtonStyle.Danger),
    );

    const message = await mainChannel.send({
      content: `<@${target.id}>`,
      embeds: [inviteEmbed],
      components: [inviteRow],
    });

    await interaction.reply({
      content: `Invitación enviada a <#${mainChannel.id}>. Tu apuesta de **${bet}** puntos queda reservada.`,
      flags: MessageFlags.Ephemeral,
    });

    const inviteCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: DUEL_PHASE_TIMEOUT_MS,
    });

    inviteCollector.on("collect", (button: ButtonInteraction) => {
      void (async () => {
        try {
          if (button.user.id !== target.id) {
            await button.reply({ content: DUEL_NOT_FOR_YOU, flags: MessageFlags.Ephemeral });
            return;
          }

          if (button.customId === "duel-deny") {
            sumPointsToUser(guildId, challenger.id, bet);
            await button.update({
              embeds: [
                EmbedBuilder.from(inviteEmbed).setDescription(
                  formatMessage(pickRandom(DUEL_DENIED), {
                    challenger: `<@${challenger.id}>`,
                    target: `<@${target.id}>`,
                  }),
                ),
              ],
              components: [],
            });
            inviteCollector.stop("handled");
            return;
          }

          if (button.customId !== "duel-accept") {
            return;
          }

          // Target may have spent points since the pre-check — reserve atomically.
          const targetCharged = subtractPointsFromUser(guildId, target.id, bet);
          if (!targetCharged) {
            sumPointsToUser(guildId, challenger.id, bet);
            await button.update({
              embeds: [
                EmbedBuilder.from(inviteEmbed).setDescription(
                  formatMessage(pickRandom(DUEL_TARGET_BROKE), {
                    target: `<@${target.id}>`,
                    challenger: `<@${challenger.id}>`,
                    bet,
                  }),
                ),
              ],
              components: [],
            });
            inviteCollector.stop("handled");
            return;
          }

          const rpsEmbed = EmbedBuilder.from(inviteEmbed).setDescription(
            `⚔️ ¡Duelo aceptado! <@${challenger.id}> vs <@${target.id}> por **${bet}** puntos.\n\n` +
              `Elegid vuestra arma. Tenéis 5 minutos. El que no elija, pierde su apuesta.`,
          );

          await button.update({ embeds: [rpsEmbed], components: [buildRpsRow()] });
          inviteCollector.stop("handled");

          this.runRpsPhase(message, rpsEmbed, guildId, challenger.id, target.id, bet);
        } catch (error) {
          logger.error({ err: error, guildId }, "Duel invite handling failed");
        }
      })();
    });

    inviteCollector.on("end", (_collected, reason) => {
      if (reason === "handled") {
        return;
      }
      sumPointsToUser(guildId, challenger.id, bet);
      void message
        .edit({
          embeds: [
            EmbedBuilder.from(inviteEmbed).setDescription(
              formatMessage(pickRandom(DUEL_INVITE_TIMEOUT), {
                challenger: `<@${challenger.id}>`,
                target: `<@${target.id}>`,
              }),
            ),
          ],
          components: [],
        })
        .catch((error: unknown) => logger.warn({ err: error }, "Failed to edit expired duel invite"));
    });
  }

  private runRpsPhase(
    message: Message,
    baseEmbed: EmbedBuilder,
    guildId: string,
    challengerId: string,
    targetId: string,
    bet: number,
  ): void {
    const duelists = [challengerId, targetId];
    const choices = new Map<string, RpsChoice>();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: DUEL_PHASE_TIMEOUT_MS,
    });

    collector.on("collect", (button: ButtonInteraction) => {
      void (async () => {
        try {
          if (!duelists.includes(button.user.id)) {
            await button.reply({ content: DUEL_NOT_FOR_YOU, flags: MessageFlags.Ephemeral });
            return;
          }

          if (choices.has(button.user.id)) {
            await button.reply({ content: DUEL_ALREADY_CHOSE, flags: MessageFlags.Ephemeral });
            return;
          }

          const choice = customIdToChoice(button.customId);
          if (!choice) {
            return;
          }

          choices.set(button.user.id, choice);

          if (choices.size < duelists.length) {
            await button.reply({ content: DUEL_CHOICE_REGISTERED, flags: MessageFlags.Ephemeral });
            return;
          }

          const challengerChoice = choices.get(challengerId)!;
          const targetChoice = choices.get(targetId)!;

          let resultText: string;
          if (challengerChoice === targetChoice) {
            sumPointsToUser(guildId, challengerId, bet);
            sumPointsToUser(guildId, targetId, bet);
            resultText = formatMessage(pickRandom(DUEL_DRAW), {
              a: `<@${challengerId}>`,
              b: `<@${targetId}>`,
            });
          } else {
            const challengerWins = BEATS[challengerChoice] === targetChoice;
            const winnerId = challengerWins ? challengerId : targetId;
            const loserId = challengerWins ? targetId : challengerId;
            const winnerChoice = challengerWins ? challengerChoice : targetChoice;
            const loserChoice = challengerWins ? targetChoice : challengerChoice;

            sumPointsToUser(guildId, winnerId, bet * 2);
            resultText = formatMessage(pickRandom(DUEL_WIN), {
              winner: `<@${winnerId}>`,
              loser: `<@${loserId}>`,
              amount: bet,
              winnerChoice: CHOICE_LABEL[winnerChoice],
              loserChoice: CHOICE_LABEL[loserChoice],
            });
          }

          await button.update({
            embeds: [EmbedBuilder.from(baseEmbed).setDescription(resultText)],
            components: [],
          });
          collector.stop("handled");
        } catch (error) {
          logger.error({ err: error, guildId }, "Duel RPS handling failed");
        }
      })();
    });

    collector.on("end", (_collected, reason) => {
      if (reason === "handled") {
        return;
      }

      const slackers = duelists.filter((id) => !choices.has(id));
      const choosers = duelists.filter((id) => choices.has(id));

      for (const chooserId of choosers) {
        sumPointsToUser(guildId, chooserId, bet);
      }

      const resultText =
        slackers.length === duelists.length
          ? pickRandom(DUEL_NO_CHOICE_BOTH)
          : formatMessage(pickRandom(DUEL_NO_CHOICE_ONE), {
              slacker: `<@${slackers[0]}>`,
              chooser: `<@${choosers[0]}>`,
              bet,
            });

      void message
        .edit({
          embeds: [EmbedBuilder.from(baseEmbed).setDescription(resultText)],
          components: [],
        })
        .catch((error: unknown) => logger.warn({ err: error }, "Failed to edit expired duel"));
    });
  }
}
