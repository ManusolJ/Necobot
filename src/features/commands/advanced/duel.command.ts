import { logger } from "@infrastructure/config/logger.config.js";

import { getGuildSettings } from "@core/services/guild.service.js";
import { getGuildUser, isUserExcluded, sumPointsToUser } from "@core/services/user.service.js";
import { RPS_CHOICES, payWinner, refundStake, reserveStake, resolveRps } from "@core/services/duel.service.js";

import type { RpsChoice } from "@shared/types/rps-choice.type.js";

import { pickRandom } from "@shared/utils/pick-random.util.js";
import { EMBED_COLOR } from "@shared/consts/branding.constants.js";
import { formatMessage } from "@shared/utils/format-message.util.js";
import { requireGuildMember } from "@shared/utils/guild-context.util.js";
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
  CHOICE_BUTTON,
  choiceLabel,
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

const CHOICE_ID_PREFIX = "duel-";
const ACCEPT_ID = "duel-accept";
const DENY_ID = "duel-deny";

const HANDLED = "handled";

const TIMEOUT_MINUTES = Math.round(DUEL_PHASE_TIMEOUT_MS / 60_000);

function buildRpsRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    RPS_CHOICES.map((choice) =>
      new ButtonBuilder()
        .setCustomId(`${CHOICE_ID_PREFIX}${choice}`)
        .setLabel(CHOICE_BUTTON[choice].label)
        .setEmoji(CHOICE_BUTTON[choice].emoji)
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

function customIdToChoice(customId: string): RpsChoice | undefined {
  return RPS_CHOICES.find((choice) => customId === `${CHOICE_ID_PREFIX}${choice}`);
}

function conclude(embed: EmbedBuilder, description: string): { embeds: EmbedBuilder[]; components: [] } {
  return { embeds: [EmbedBuilder.from(embed).setDescription(description)], components: [] };
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
    const { guildId, member } = requireGuildMember(interaction);
    const opponent = interaction.options.getUser("opponent", false);
    const bet = interaction.options.getInteger("bet", false) ?? DUEL_DEFAULT_BET;

    if (!opponent || opponent.id === this.container.client.user?.id) {
      await this.runVersusBot(interaction, guildId, member);
      return;
    }

    await this.runVersusUser(interaction, guildId, member, opponent, bet);
  }

  private expireWith(
    edit: (payload: { embeds: EmbedBuilder[]; components: [] }) => Promise<unknown>,
    embed: EmbedBuilder,
    reason: string,
    describe: () => string,
    onExpire?: () => void,
  ): void {
    if (reason === HANDLED) {
      return;
    }

    onExpire?.();

    void edit(conclude(embed, describe())).catch((error: unknown) =>
      logger.warn({ err: error }, "Failed to edit expired duel message"),
    );
  }

  private async runVersusBot(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    member: GuildMember,
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("Duelo contra la criatura")
      .setDescription(
        `<@${member.id}> me reta a piedra, papel o tijeras. Elige tu arma. Tienes ${TIMEOUT_MINUTES} minutos.`,
      );

    await interaction.reply({ embeds: [embed], components: [buildRpsRow()] });
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: DUEL_PHASE_TIMEOUT_MS,
    });

    collector.on("collect", (button: ButtonInteraction) => {
      void this.guardHandler(guildId, "Duel vs bot failed", async () => {
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
          userChoice: choiceLabel(userChoice),
          botChoice: choiceLabel(botChoice),
          reward: DUEL_VS_BOT_REWARD,
        };

        const outcome = resolveRps(userChoice, botChoice);
        if (outcome === "challenger") {
          sumPointsToUser(guildId, member.id, DUEL_VS_BOT_REWARD);
        }

        const pool = { draw: DUEL_BOT_DRAW, challenger: DUEL_BOT_WIN, target: DUEL_BOT_LOSE }[outcome];

        await button.update(conclude(embed, formatMessage(pickRandom(pool), replacements)));
        collector.stop(HANDLED);
      });
    });

    collector.on("end", (_collected, reason) => {
      this.expireWith(
        (payload) => interaction.editReply(payload),
        embed,
        reason,
        () => formatMessage(pickRandom(DUEL_BOT_TIMEOUT), { user: `<@${member.id}>` }),
      );
    });
  }

  private async runVersusUser(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    challenger: GuildMember,
    target: User,
    bet: number,
  ): Promise<void> {
    const rejection = this.rejectUnduellableTarget(guildId, challenger, target);
    if (rejection) {
      await interaction.reply({ content: rejection, flags: MessageFlags.Ephemeral });
      return;
    }

    const mentions = { challenger: `<@${challenger.id}>`, target: `<@${target.id}>` };

    const targetPoints = getGuildUser(guildId, target.id)?.points ?? 0;
    if (targetPoints < bet) {
      await interaction.reply(formatMessage(pickRandom(DUEL_TARGET_BROKE), { ...mentions, bet }));
      return;
    }

    if (!reserveStake(guildId, challenger.id, bet)) {
      await interaction.reply(
        `Nyaha~ ¿retando a duelos de **${bet}** puntos sin tenerlos, ${mentions.challenger}? La confianza de los arruinados es admirable. Cancelado.`,
      );
      return;
    }

    const mainChannelId = getGuildSettings(guildId)?.mainChannelId;
    const mainChannel = mainChannelId
      ? await this.container.client.channels.fetch(mainChannelId).catch(() => null)
      : null;

    if (!mainChannel?.isSendable()) {
      refundStake(guildId, challenger.id, bet);
      await interaction.reply({
        content: "No pude acceder al canal principal para enviar la invitación. Puntos devueltos.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const inviteEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("¡Invitación a duelo!")
      .setDescription(
        `${mentions.challenger} reta a ${mentions.target} a piedra, papel o tijeras por **${bet}** puntos.\n\n` +
          `${mentions.target}, ¿aceptas? Tienes ${TIMEOUT_MINUTES} minutos antes de que esto se convierta en una humillación pública.`,
      );

    const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ACCEPT_ID).setLabel("Aceptar").setEmoji("⚔️").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(DENY_ID).setLabel("Rechazar").setEmoji("🏳️").setStyle(ButtonStyle.Danger),
    );

    const message = await mainChannel.send({
      content: mentions.target,
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
      void this.guardHandler(guildId, "Duel invite handling failed", async () => {
        if (button.user.id !== target.id) {
          await button.reply({ content: DUEL_NOT_FOR_YOU, flags: MessageFlags.Ephemeral });
          return;
        }

        if (button.customId === DENY_ID) {
          refundStake(guildId, challenger.id, bet);
          await button.update(conclude(inviteEmbed, formatMessage(pickRandom(DUEL_DENIED), mentions)));
          inviteCollector.stop(HANDLED);
          return;
        }

        if (button.customId !== ACCEPT_ID) {
          return;
        }

        if (!reserveStake(guildId, target.id, bet)) {
          refundStake(guildId, challenger.id, bet);
          await button.update(
            conclude(inviteEmbed, formatMessage(pickRandom(DUEL_TARGET_BROKE), { ...mentions, bet })),
          );
          inviteCollector.stop(HANDLED);
          return;
        }

        const rpsEmbed = EmbedBuilder.from(inviteEmbed).setDescription(
          `¡Duelo aceptado! ${mentions.challenger} vs ${mentions.target} por **${bet}** puntos.\n\n` +
            `Elegid vuestra arma. Tenéis ${TIMEOUT_MINUTES} minutos. El que no elija, pierde su apuesta.`,
        );

        await button.update({ embeds: [rpsEmbed], components: [buildRpsRow()] });
        inviteCollector.stop(HANDLED);

        this.runRpsPhase(message, rpsEmbed, guildId, challenger.id, target.id, bet);
      });
    });

    inviteCollector.on("end", (_collected, reason) => {
      this.expireWith(
        (payload) => message.edit(payload),
        inviteEmbed,
        reason,
        () => formatMessage(pickRandom(DUEL_INVITE_TIMEOUT), { ...mentions, minutes: TIMEOUT_MINUTES }),
        () => refundStake(guildId, challenger.id, bet),
      );
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
      void this.guardHandler(guildId, "Duel RPS handling failed", async () => {
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

        const challengerChoice = choices.get(challengerId);
        const targetChoice = choices.get(targetId);

        if (challengerChoice === undefined || targetChoice === undefined) {
          await button.reply({ content: DUEL_CHOICE_REGISTERED, flags: MessageFlags.Ephemeral });
          return;
        }

        await button.update(
          conclude(baseEmbed, this.settleDuel(guildId, challengerId, targetId, challengerChoice, targetChoice, bet)),
        );
        collector.stop(HANDLED);
      });
    });

    collector.on("end", (_collected, reason) => {
      this.expireWith(
        (payload) => message.edit(payload),
        baseEmbed,
        reason,
        () => this.settleAbandonedDuel(guildId, duelists, choices, bet),
      );
    });
  }

  private settleDuel(
    guildId: string,
    challengerId: string,
    targetId: string,
    challengerChoice: RpsChoice,
    targetChoice: RpsChoice,
    bet: number,
  ): string {
    const outcome = resolveRps(challengerChoice, targetChoice);

    if (outcome === "draw") {
      refundStake(guildId, challengerId, bet);
      refundStake(guildId, targetId, bet);
      return formatMessage(pickRandom(DUEL_DRAW), { a: `<@${challengerId}>`, b: `<@${targetId}>` });
    }

    const challengerWins = outcome === "challenger";
    const winnerId = challengerWins ? challengerId : targetId;
    const loserId = challengerWins ? targetId : challengerId;

    payWinner(guildId, winnerId, bet);

    return formatMessage(pickRandom(DUEL_WIN), {
      winner: `<@${winnerId}>`,
      loser: `<@${loserId}>`,
      amount: bet,
      winnerChoice: choiceLabel(challengerWins ? challengerChoice : targetChoice),
      loserChoice: choiceLabel(challengerWins ? targetChoice : challengerChoice),
    });
  }

  private settleAbandonedDuel(
    guildId: string,
    duelists: string[],
    choices: Map<string, RpsChoice>,
    bet: number,
  ): string {
    const slacker = duelists.find((id) => !choices.has(id));
    const chooser = duelists.find((id) => choices.has(id));

    for (const id of duelists.filter((duelist) => choices.has(duelist))) {
      refundStake(guildId, id, bet);
    }

    if (slacker === undefined || chooser === undefined) {
      return pickRandom(DUEL_NO_CHOICE_BOTH);
    }

    return formatMessage(pickRandom(DUEL_NO_CHOICE_ONE), {
      slacker: `<@${slacker}>`,
      chooser: `<@${chooser}>`,
      bet,
    });
  }

  private rejectUnduellableTarget(guildId: string, challenger: GuildMember, target: User): string | undefined {
    if (target.bot) {
      return "Para retar a un bot, déjame el campo vacío y pelea conmigo, nyaha~.";
    }

    if (target.id === challenger.id) {
      return "¿Un duelo contra ti mismo? Busca ayuda. O un rival.";
    }

    if (isUserExcluded(guildId, target.id)) {
      return `<@${target.id}> está excluido de las actividades del bot. No se puede duelar con fantasmas.`;
    }

    return undefined;
  }

  private async guardHandler(guildId: string, message: string, handler: () => Promise<void>): Promise<void> {
    try {
      await handler();
    } catch (error) {
      logger.error({ err: error, guildId }, message);
    }
  }
}
