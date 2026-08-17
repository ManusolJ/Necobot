import type { LogLevelName } from "@shared/consts/config.constants.js";

import { LogLevel } from "@sapphire/framework";

const SAPPHIRE_LEVELS: Record<LogLevelName, LogLevel> = {
  trace: LogLevel.Trace,
  debug: LogLevel.Debug,
  info: LogLevel.Info,
  warn: LogLevel.Warn,
  error: LogLevel.Error,
  fatal: LogLevel.Fatal,
};

export function getLogLevel(level: LogLevelName): LogLevel {
  return SAPPHIRE_LEVELS[level];
}
