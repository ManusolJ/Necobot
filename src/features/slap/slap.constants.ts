import type { SlapResult } from "@shared/types/slap-result.type.js";

export const SLAP_COST = 5;

export const SLAP_RESOLUTIONS: readonly SlapResult[] = [
  {
    image: "slap.jpg",
    message: "Hey {user}, **SLAP**. Nice balls, bro.",
  },
  {
    image: "slap-b.jpg",
    message: "Oye {user}... *SLURP* uhhh, ya no se que iba a decir.",
  },
  {
    image: "slap-c.jpg",
    message: "Toma, {user}. Un ladrillo de C4. Hazle un favor al mundo y usalo en tus bolas.",
  },
];

export const NO_POINTS_MESSAGE =
  "Intentado dar slaps sin dinero en tu cuenta, eh??! Nyahaha~~ Patetico. Vuelve cuando tengas puntos.";
