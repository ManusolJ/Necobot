import { AttachmentBuilder } from "discord.js";
import { VisionResult } from "./vision-result.type.js";

export type Inspection = {
  result: VisionResult;
  file: AttachmentBuilder;
};
