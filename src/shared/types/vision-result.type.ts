import type { VisionTagId } from "./vision-tag-id.type.js";

export type VisionResult =
  | { status: "tagged"; tagId: VisionTagId; confidence: number }
  | { status: "unknown" }
  | { status: "unavailable" };
