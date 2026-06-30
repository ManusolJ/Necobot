import type { EarnAction } from "@shared/types/earn-action.type.js";

export interface AwardInput {
  guildId: string;
  userId: string;
  amount: number;
  action: EarnAction;
}
