import type { CommandGroup } from "@shared/types/command-group.type.js";

import { SLAP_COST } from "@features/slap/slap.constants.js";
import { MINE_COST } from "@features/minefield/minefield.constants.js";
import { SPEAK_POINTS_COST } from "@features/voice/voice.constants.js";
import { PUNISH_PERCENT } from "@features/moderation/moderation.constants.js";
import { UWUFY_COST, UWUFY_MESSAGE_COUNT } from "@features/uwufier/uwufier.constants.js";

export const INFO_EMBED_TITLE = "Mis comandos";

export const INFO_EMBED_INTRO =
  "Todo lo que sé hacer, por si te pierdes. Escribe `/` en el chat y elige el que quieras.";

export const INFO_COMMAND_GROUPS: readonly CommandGroup[] = [
  {
    name: "Economía",
    commands: [
      { name: "gift", description: "Regala puntos a otro usuario." },
      { name: "beg", description: "Mendiga puntos y prueba suerte." },
      { name: "balance", description: "Consulta cuántos puntos tienes." },
    ],
  },
  {
    name: "Juegos",
    commands: [
      { name: "roll", description: "Tira los dados que elijas." },
      { name: "duel", description: "Reta a alguien a piedra, papel o tijeras." },
      { name: "minefield", description: `Planta minas en el canal principal (${MINE_COST}pts cada una).` },
    ],
  },
  {
    name: "Imagen",
    commands: [
      { name: "scan", description: "Enséñame una imagen y te diré qué veo." },
      { name: "monster-time", description: "Enséñame tu Monster, más te vale que sea viernes." },
    ],
  },
  {
    name: "Servidor",
    commands: [
      { name: "cheer", description: "Felicita el cumpleaños a alguien." },
      { name: "slap", description: `Dale un slap a quien se lo merezca (${SLAP_COST}pts).` },
      {
        name: "uwufier",
        description: `Uwufica los proximos ${UWUFY_MESSAGE_COUNT} mensajes de alguien (${UWUFY_COST}pts).`,
      },
      { name: "reminder", description: "Te aviso con una mención cuando pase el tiempo que elijas." },
      { name: "speak", description: `Me uno a tu canal de voz y suelto una frase (${SPEAK_POINTS_COST}pts).` },
    ],
  },
  {
    name: "Información",
    commands: [
      { name: "info", description: "Muestra esta misma lista de comandos." },
      { name: "profile", description: "Muestra tus estadísticas del servidor." },
    ],
  },
  {
    name: "Moderación",
    commands: [
      { name: "exclude", description: "Excluye a un usuario de mis actividades, o lo readmite." },
      { name: "punish", description: `Confisca el ${String(PUNISH_PERCENT * 100)}% de los puntos de quien elijas.` },
    ],
  },
  {
    name: "Configuración (solo admin)",
    commands: [
      { name: "settings", description: "Configura el bot para este servidor." },
      { name: "deploy", description: "Gestiona el registro de comandos (solo dueño)." },
      { name: "add-channel", description: "Añade un canal extra para algunas de mis funciones." },
    ],
  },
];
