import { logger } from "@infrastructure/config/logger.config.js";

import { PROVIDER, UWUFIER_URL, UWUFY_TIMEOUT_MS } from "./uwufier.constants.js";

export async function uwuifyText(text: string): Promise<string | undefined> {
  try {
    const response = await fetch(UWUFIER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: PROVIDER, text }),
      signal: AbortSignal.timeout(UWUFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "Uwufier request failed");
      return undefined;
    }

    const data = (await response.json()) as { uwu?: string };
    const uwu = data.uwu?.trim();

    return uwu === undefined || uwu === "" ? undefined : uwu;
  } catch (error) {
    logger.error({ err: error }, "Uwufier request errored");
    return undefined;
  }
}
