import { env } from "@infrastructure/config/env.config.js";
import { logger } from "@infrastructure/config/logger.config.js";

import type { ChatMessage } from "@shared/interfaces/chat-message.interface.js";

import { AI_MODEL_NAME, AI_GENERATION_TIMEOUT_MS } from "@shared/consts/ai.constants.js";

export function isOllamaConfigured(): boolean {
  return env.OLLAMA_URL !== undefined;
}

export async function requestChatCompletion(messages: ChatMessage[]): Promise<string | undefined> {
  if (!env.OLLAMA_URL) {
    return undefined;
  }

  try {
    const response = await fetch(`${env.OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL_NAME, messages, stream: false }),
      signal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error({ status: response.status, body: await response.text() }, "Ollama request failed");
      return undefined;
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content?.trim();
    return content ? content : undefined;
  } catch (error) {
    logger.error({ err: error }, "Ollama request errored");
    return undefined;
  }
}
