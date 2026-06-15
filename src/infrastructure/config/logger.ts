import { LoggerOptions, pino } from "pino";
import { env } from "./env.js";
import { DEV_ENV } from "@shared/consts/config.constants.js";

const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
};

if (env.NODE_ENV === DEV_ENV) {
  loggerOptions.transport = {
    target: "pino-pretty",
    options: { colorize: true },
  };
}

export const logger = pino(loggerOptions);
