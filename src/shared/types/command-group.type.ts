import type { CommandSummary } from "./command-summary.type.js";

export type CommandGroup = {
  name: string;
  commands: readonly CommandSummary[];
};
