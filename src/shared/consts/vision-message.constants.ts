import type { VisionTagId } from "@shared/types/vision-tag-id.type.js";

export const VISION_TAG_MESSAGES: Record<VisionTagId, readonly string[]> = {
  cat: [
    "Un gato. Por fin alguien con clase en este servidor, {user}.",
    "Bonito felino, {user}. Tiene más dignidad que tú y se lame solo.",
    "Nyaha~ un gato. Mi gente. Tú sigue siendo un mono con teclado, {user}.",
    "Burunyaa~ ese michi me mira con la superioridad que a ti te falta, {user}.",
  ],
  dog: [
    "Un perro. Leal, obediente, sin criterio propio... me recuerda a ti, {user}.",
    "Nyaha~ un chucho. Bueno, {user}, al menos uno de los dos tiene excusa para babear.",
    "Perro detectado. Aceptable, {user}, pero los gatos siguen ganando. Siempre.",
  ],
  energy_drink: [
    "{user} otra vez a base de lata. Tu corazón me va a pasar la factura a mí.",
    "Nyaha~ una bebida energética. El desayuno de los campeones, si los campeones tuviesen taquicardia, {user}.",
    "Eso no es una bebida, {user}, es una demanda judicial en formato lata.",
  ],
  anime: [
    "Un dibujito. Mis respetos, {user}, tienes el gusto exactamente donde esperaba.",
    "Nyaha~ anime. Claro que sí, {user}. Nunca cambies, sobre todo porque no puedes.",
    "Detecto trazos 2D y cero vida social. Todo en orden, {user}.",
  ],
};

export const VISION_UNKNOWN: readonly string[] = [
  "Eso no es nada reconocible, {user}. Como tu aportación al servidor.",
  "Burunyaa~ mi visión divina no alcanza a comprender esa imagen. Prueba con un gato.",
  "Nyaha~ he mirado eso fijamente y sigo sin saber qué es. Enséñame algo mejor, {user}.",
  "No tengo ni idea de qué es eso, {user}, y tampoco me pagan lo suficiente para averiguarlo.",
];

export const VISION_FALLBACK = "Ta muy oscuro por aqui asi que no veo nada. Prueba en un rato, plebeyo.";
