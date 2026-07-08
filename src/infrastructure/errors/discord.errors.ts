import { AppError } from "./app-error.js";

export class GuildMemberNotFound extends AppError {
  public constructor(guildId: string) {
    super("guild_member_not_found", { context: { guildId } });
  }
}
