import { logger } from "@infrastructure/config/logger.config.js";

import type { LabelScore } from "@shared/types/label-score.type.js";
import type { ImageClassifier } from "@shared/types/image-classifier.type.js";

import { VISION_MODEL_NAME, VISION_MODEL_CACHE_DIR } from "@shared/consts/vision.constants.js";

import { pipeline, RawImage } from "@huggingface/transformers";

let classifierPromise: Promise<ImageClassifier> | undefined;

function loadClassifier(): Promise<ImageClassifier> {
  classifierPromise ??= pipeline("zero-shot-image-classification", VISION_MODEL_NAME, {
    cache_dir: VISION_MODEL_CACHE_DIR,
  });

  return classifierPromise;
}

export async function warmUpImageClassifier(): Promise<void> {
  try {
    await loadClassifier();
    logger.info({ model: VISION_MODEL_NAME }, "Image classifier ready");
  } catch (error) {
    classifierPromise = undefined;
    logger.error({ err: error, model: VISION_MODEL_NAME }, "Failed to warm up the image classifier");
  }
}

export async function classifyImage(image: Blob, labels: readonly string[]): Promise<LabelScore[] | undefined> {
  let classifier: ImageClassifier;

  try {
    classifier = await loadClassifier();
  } catch (error) {
    classifierPromise = undefined;
    logger.error({ err: error, model: VISION_MODEL_NAME }, "Failed to load the image classifier");
    return undefined;
  }

  try {
    const raw = await RawImage.fromBlob(image);

    return await classifier(raw, [...labels], { hypothesis_template: "{}" });
  } catch (error) {
    logger.error({ err: error }, "Image classification failed");
    return undefined;
  }
}
