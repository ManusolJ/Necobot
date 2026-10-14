import type { UserData } from "@shared/types/user-data.type.js";
import type { UserState } from "@shared/types/user-state.type.js";
import type { UserStats } from "@shared/types/user-stats.type.js";

export type GuildUser = UserData & Omit<UserState, "guildId" | "userId"> & Omit<UserStats, "guildId" | "userId">;
