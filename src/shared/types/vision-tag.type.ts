import { VisionTagId } from "./vision-tag-id.type.js";

export interface VisionTag {
  id: VisionTagId;
  minConfidence: number;
  prompts: readonly string[];
}
