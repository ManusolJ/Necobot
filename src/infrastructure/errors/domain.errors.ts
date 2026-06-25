import { AppError } from "./app-error.js";

export class GuildSettingsNotFoundError extends AppError {
  public constructor(guildId: string) {
    super("guild_settings_not_found", { context: { guildId } });
  }
}

export class GuildSettingsPersistError extends AppError {
  public constructor(guildId: string, cause?: unknown) {
    super("guild_settings_persist_failed", { context: { guildId }, cause });
  }
}

export class GuildNotConfiguredError extends AppError {
  public constructor(guildId: string) {
    super("guild_not_configured", { context: { guildId } });
  }
}
