import { LogLevel } from "@sapphire/framework";

export function getLogLevel(level: string): LogLevel {
  switch (level) {
    case "info":
      return LogLevel.Info;
    case "debug":
      return LogLevel.Debug;
    default:
      return LogLevel.Info;
  }
}
