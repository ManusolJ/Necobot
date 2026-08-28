import { logger } from "@infrastructure/config/logger.config.js";
import { ImageTooLargeError, InvalidImageAttachmentError } from "@infrastructure/errors/domain.errors.js";

import { VISION_IMAGE_MAX_BYTES, VISION_IMAGE_MIME_TYPES, VISION_DOWNLOAD_TIMEOUT_MS } from "./vision.constants.js";

import type { Attachment } from "discord.js";

export function assertSupportedImage(attachment: Attachment): void {
  const contentType = attachment.contentType?.split(";")[0]?.trim() ?? "";

  if (!VISION_IMAGE_MIME_TYPES.includes(contentType)) {
    throw new InvalidImageAttachmentError(attachment.id, contentType);
  }

  if (attachment.size > VISION_IMAGE_MAX_BYTES) {
    throw new ImageTooLargeError(attachment.id, attachment.size);
  }
}

export async function downloadImage(attachment: Attachment): Promise<Blob | undefined> {
  try {
    const response = await fetch(attachment.url, {
      signal: AbortSignal.timeout(VISION_DOWNLOAD_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error({ status: response.status, attachmentId: attachment.id }, "Attachment download failed");
      return undefined;
    }

    return await response.blob();
  } catch (error) {
    logger.error({ err: error, attachmentId: attachment.id }, "Attachment download errored");
    return undefined;
  }
}
