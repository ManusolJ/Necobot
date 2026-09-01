import type { LabelScore } from "@shared/types/label-score.type.js";

import { VISION_TAG_MESSAGES } from "@features/vision/vision.messages.js";
import { VISION_TAGS, VISION_DISTRACTOR_PROMPTS } from "@features/vision/vision.constants.js";

import { describe, expect, it, vi } from "vitest";

vi.mock("@infrastructure/ai/clip.client.js", () => ({
  classifyImage: vi.fn(),
  warmUpImageClassifier: vi.fn(),
}));

const { resolveVisionTag } = await import("@features/vision/vision.service.js");

function tagPrompts(id: string): readonly string[] {
  const tag = VISION_TAGS.find((candidate) => candidate.id === id);
  if (!tag) {
    throw new Error(`Unknown tag in fixture: ${id}`);
  }
  return tag.prompts;
}

function spread(id: string, total: number): LabelScore[] {
  const prompts = tagPrompts(id);
  return prompts.map((label) => ({ label, score: total / prompts.length }));
}

function distractors(total: number): LabelScore[] {
  return VISION_DISTRACTOR_PROMPTS.map((label) => ({
    label,
    score: total / VISION_DISTRACTOR_PROMPTS.length,
  }));
}

describe("resolveVisionTag", () => {
  it("aggregates every prompt of a tag before comparing to the threshold", () => {
    const result = resolveVisionTag([...spread("cat", 0.9), ...distractors(0.1)]);

    expect(result).toMatchObject({ status: "tagged", tagId: "cat" });
  });

  it("stays unknown when the distractors absorb most of the score", () => {
    const result = resolveVisionTag([...spread("cat", 0.08), ...distractors(0.92)]);

    expect(result).toEqual({ status: "unknown" });
  });

  it("stays unknown when the best tag sits just under its threshold", () => {
    const result = resolveVisionTag([...spread("cat", 0.44), ...distractors(0.56)]);

    expect(result).toEqual({ status: "unknown" });
  });

  it("picks the highest scoring tag when several are present", () => {
    const result = resolveVisionTag([...spread("cat", 0.3), ...spread("dog", 0.6), ...distractors(0.1)]);

    expect(result).toMatchObject({ status: "tagged", tagId: "dog" });
  });

  it("ignores labels that belong to no tag", () => {
    const result = resolveVisionTag([{ label: "a prompt nobody registered", score: 1 }]);

    expect(result).toEqual({ status: "unknown" });
  });

  it("returns unknown for an empty score list", () => {
    expect(resolveVisionTag([])).toEqual({ status: "unknown" });
  });
});

describe("vision tag configuration", () => {
  it("gives every tag at least one reply message", () => {
    for (const tag of VISION_TAGS) {
      expect(VISION_TAG_MESSAGES[tag.id].length).toBeGreaterThan(0);
    }
  });

  it("does not reuse a prompt across tags or distractors", () => {
    const prompts = [...VISION_TAGS.flatMap((tag) => tag.prompts), ...VISION_DISTRACTOR_PROMPTS];

    expect(new Set(prompts).size).toBe(prompts.length);
  });
});
