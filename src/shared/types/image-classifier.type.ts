import type { pipeline } from "@huggingface/transformers";

export type ImageClassifier = Awaited<ReturnType<typeof pipeline<"zero-shot-image-classification">>>;
