import { assetPath } from "@shared/utils/asset-path.util.js";
import { pickRandom } from "@shared/utils/pick-random.util.js";
import { formatMessage } from "@shared/utils/format-message.util.js";

import { CHEER_MESSAGES } from "./cheer.messages.js";

import { AttachmentBuilder } from "discord.js";

const CHEER_IMAGE_NAME = "cheer.jpg";
const CHEER_IMAGE_PATH = assetPath("img", CHEER_IMAGE_NAME);

export function buildCheerMessage(mentions: string): { content: string; files: AttachmentBuilder[] } {
  return {
    content: formatMessage(pickRandom(CHEER_MESSAGES), { user: mentions }),
    files: [new AttachmentBuilder(CHEER_IMAGE_PATH, { name: CHEER_IMAGE_NAME })],
  };
}
