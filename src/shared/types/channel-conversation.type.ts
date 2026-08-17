import type { ChatMessage } from "./chat-message.type.js";

export interface ChannelConversation {
  messages: ChatMessage[];
  lastActivityAt: number;
}
