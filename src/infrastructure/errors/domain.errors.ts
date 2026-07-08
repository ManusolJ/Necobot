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

export class GuildUserPersistError extends AppError {
  public constructor(guildId: string, userId: string, cause?: unknown) {
    super("guild_user_persist_failed", { context: { guildId, userId }, cause });
  }
}

export class BotPermissionsNotVerified extends AppError {
  public constructor() {
    super("bot_permission_not_verified");
  }
}

export class BotPermissionNotEnough extends AppError {
  public constructor(channelId: string) {
    super("bot_permission_not_enough", { context: { channelId } });
  }
}

export class GuildChannelPersistError extends AppError {
  public constructor(guildId: string, purpose: string, cause?: unknown) {
    super("guild_channel_persist_failed", { context: { guildId, purpose }, cause });
  }
}

export class UserNotInVoiceError extends AppError {
  public constructor(userId: string) {
    super("user_not_in_voice", { context: { userId } });
  }
}

export class BotVoiceBusyError extends AppError {
  public constructor(guildId: string) {
    super("bot_voice_busy", { context: { guildId } });
  }
}

export class BotVoicePermissionError extends AppError {
  public constructor(channelId: string) {
    super("bot_voice_permission_not_enough", { context: { channelId } });
  }
}
