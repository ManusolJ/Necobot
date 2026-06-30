import { LogLevel } from "@sapphire/framework";

export function getLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case "trace":
      return LogLevel.Trace;
    case "debug":
      return LogLevel.Debug;
    case "info":
      return LogLevel.Info;
    case "warn":
      return LogLevel.Warn;
    case "error":
      return LogLevel.Error;
    case "fatal":
      return LogLevel.Fatal;
    default:
      console.warn(
        `Unknown LOG_LEVEL "${level}", defaulting to Info. Expected one of: trace, debug, info, warn, error, fatal.`,
      );
      return LogLevel.Info;
  }
}
