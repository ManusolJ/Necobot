import { classifyImage } from "@infrastructure/ai/clip.client.js";

import { VisionTag } from "@shared/types/vision-tag.type.js";
import { VisionTagId } from "@shared/types/vision-tag-id.type.js";
import { VisionResult } from "@shared/types/vision-result.type.js";
import { VISION_TAGS, VISION_DISTRACTOR_PROMPTS } from "@shared/consts/vision.constants.js";
import { LabelScore } from "@shared/types/label-score.type.js";

const TAG_BY_ID = new Map<VisionTagId, VisionTag>(VISION_TAGS.map((tag) => [tag.id, tag]));

const PROMPT_TO_TAG = new Map<string, VisionTagId>(
  VISION_TAGS.flatMap((tag) => tag.prompts.map((prompt) => [prompt, tag.id] as const)),
);

const CANDIDATE_LABELS: readonly string[] = [...PROMPT_TO_TAG.keys(), ...VISION_DISTRACTOR_PROMPTS];

export function resolveVisionTag(scores: readonly LabelScore[]): VisionResult {
  const totals = new Map<VisionTagId, number>();

  for (const { label, score } of scores) {
    const tagId = PROMPT_TO_TAG.get(label);
    if (tagId !== undefined) {
      totals.set(tagId, (totals.get(tagId) ?? 0) + score);
    }
  }

  const best = [...totals.entries()].sort(([, left], [, right]) => right - left)[0];
  if (!best) {
    return { status: "unknown" };
  }

  const [tagId, confidence] = best;
  const tag = TAG_BY_ID.get(tagId);

  if (!tag || confidence < tag.minConfidence) {
    return { status: "unknown" };
  }

  return { status: "tagged", tagId, confidence };
}

export async function analyzeImage(image: Blob): Promise<VisionResult> {
  const scores = await classifyImage(image, CANDIDATE_LABELS);

  if (!scores) {
    return { status: "unavailable" };
  }

  return resolveVisionTag(scores);
}
