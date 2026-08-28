import type { VisionTagId } from "@shared/types/vision-tag-id.type.js";

export const VISION_TAG_MESSAGES: Record<VisionTagId, readonly string[]> = {
  cat: [
    "Un gato. Por fin alguien con clase en este servidor, {user}.",
    "Bonito felino, {user}. Tiene más dignidad que tú y se lame solo.",
    "Nyaha~ un gato. Mi gente. Tú sigue siendo un mono con teclado, {user}.",
    "Burunyaa~ ese michi me mira con la superioridad que a ti te falta, {user}.",
  ],
  dog: [
    "Perro detectado, {user}, pero los gatos siguen ganando.",
    "Un perro. Leal, obediente, sin criterio propio... me recuerda a ti, {user}.",
    "Nyaha~ un chucho. Bueno, {user}, al menos uno de los dos tiene excusa para babear.",
  ],
  energy_drink: [
    "Espero que seas viernes, {user}. Por que sino... Bueno, ya sabes. Tendre que usar este ladrillo.",
    "Nyaha~ una bebida energética. El desayuno de los campeones, si los campeones tuviesen taquicardia, {user}.",
    "{User} espero que te des cuenta que no vas a llegar a mas de 60 años. Pero bueno, para lo que aportas esta bien.",
  ],
  anime: [
    "Detecto trazos 2D y cero vida social. Todo en orden, {user}.",
    "Un dibujito. Mis respetos, {user}, tienes el gusto exactamente donde esperaba.",
    "Nyaha~ anime. Claro que sí, {user}. Nunca cambies, sobre todo porque no puedes.",
  ],
};

export const VISION_UNKNOWN: readonly string[] = [
  "Eso no es nada reconocible, {user}. Como tu aportación al servidor.",
  "Burunyaa~ mi visión divina no alcanza a comprender esa imagen. Prueba con un gato.",
  "Nyaha~ he mirado eso fijamente y sigo sin saber qué es. Enséñame algo mejor, {user}.",
  "No tengo ni idea de qué es eso, {user}, y tampoco me pagan lo suficiente para averiguarlo.",
];

export const VISION_FALLBACK = "Ta muy oscuro por aqui asi que no veo nada. Prueba en un rato, plebeyo.";
