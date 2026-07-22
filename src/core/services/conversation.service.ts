import { requestChatCompletion } from "@infrastructure/ai/ollama.client.js";

import type { ChatMessage } from "@shared/interfaces/chat-message.interface.js";

import { AI_HISTORY_TTL_MS, AI_HISTORY_MAX_MESSAGES } from "@shared/consts/ai.constants.js";

interface ChannelConversation {
  messages: ChatMessage[];
  lastActivityAt: number;
}

const conversations = new Map<string, ChannelConversation>();

function pruneExpired(now: number): void {
  for (const [channelId, conversation] of conversations) {
    if (now - conversation.lastActivityAt > AI_HISTORY_TTL_MS) {
      conversations.delete(channelId);
    }
  }
}

export async function generateChatReply(
  channelId: string,
  authorName: string,
  text: string,
): Promise<string | undefined> {
  const now = Date.now();
  pruneExpired(now);

  const conversation = conversations.get(channelId) ?? { messages: [], lastActivityAt: now };
  const userMessage: ChatMessage = { role: "user", content: `${authorName}: ${text}` };

  const reply = await requestChatCompletion([...conversation.messages, userMessage]);
  if (!reply) {
    return undefined;
  }

  conversation.messages.push(userMessage, { role: "assistant", content: reply });
  if (conversation.messages.length > AI_HISTORY_MAX_MESSAGES) {
    conversation.messages.splice(0, conversation.messages.length - AI_HISTORY_MAX_MESSAGES);
  }
  conversation.lastActivityAt = Date.now();
  conversations.set(channelId, conversation);

  return reply;
}
