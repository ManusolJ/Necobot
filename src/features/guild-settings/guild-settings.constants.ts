import type { ChannelPurpose } from "@shared/types/channel-purpose.type.js";

export const CHANNEL_PURPOSES: { name: string; value: ChannelPurpose }[] = [
  { name: "Canal del Bot", value: "bot" },
  { name: "Canal de Memes", value: "memes" },
  { name: "Canal de Copypastas", value: "copypasta" },
  { name: "Canal de Anuncios", value: "announcements" },
  { name: "Canal de Archivo", value: "archive" },
];
