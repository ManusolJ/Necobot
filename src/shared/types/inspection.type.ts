import type { VisionResult } from "./vision-result.type.js";

import type { AttachmentBuilder } from "discord.js";

export type Inspection = {
  result: VisionResult;
  file: AttachmentBuilder;
};
