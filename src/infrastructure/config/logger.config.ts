import { env } from "./env.config.js";

import { pino } from "pino";

export const logger = pino({
  level: env.LOG_LEVEL,
});
