import type { VisionTag } from "@shared/types/vision-tag.type.js";

export const VISION_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export const VISION_DOWNLOAD_TIMEOUT_MS = 10_000;

export const VISION_IMAGE_MIME_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];

export const VISION_TAGS: readonly VisionTag[] = [
  {
    id: "cat",
    prompts: [
      "a photo of a cat",
      "a close-up photo of a cat",
      "a photo of a kitten",
      "a low resolution photo of a cat",
    ],
    minConfidence: 0.45,
  },
  {
    id: "dog",
    prompts: ["a photo of a dog", "a close-up photo of a dog", "a photo of a puppy", "a low resolution photo of a dog"],
    minConfidence: 0.45,
  },
  {
    id: "energy_drink",
    prompts: [
      "a photo of a can of energy drink",
      "a photo of a Monster Energy can",
      "a photo of a Red Bull can",
      "a close-up photo of an energy drink can",
    ],
    minConfidence: 0.4,
  },
  {
    id: "anime",
    prompts: [
      "an anime drawing of a character",
      "an anime drawing of a cat girl",
      "an anime character with cat ears",
      "a digital illustration of an anime girl",
    ],
    minConfidence: 0.7,
  },
];

export const VISION_DISTRACTOR_PROMPTS: readonly string[] = [
  "a photo of a person",
  "a selfie of a person",
  "a photo of an object",
  "a photo of a landscape",
  "a photo of food",
  "a photo of a car",
  "a meme with text on it",
  "a screenshot of a video game",
  "a screenshot of a website",
  "a screenshot of a chat conversation",
];
