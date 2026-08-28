import { logger } from "@infrastructure/config/logger.config.js";

import { assetPath } from "@shared/utils/asset-path.util.js";

import type { SapphireClient } from "@sapphire/framework";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

const srcRoot = dirname(fileURLToPath(import.meta.url));

const sharedPath = join(srcRoot, "shared");
const featuresPath = join(srcRoot, "features");

export function registerStores(client: SapphireClient): void {
  const audioPath = assetPath("audio");

  if (!existsSync(audioPath)) {
    logger.fatal({ audioPath }, "Assets directory not found - check asset-path.util depth");
    process.exit(1);
  }

  const featureDirs = readdirSync(featuresPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  client.stores.registerPath(sharedPath);

  for (const dir of featureDirs) {
    client.stores.registerPath(join(featuresPath, dir));
  }
}

export function assertPiecesLoaded(client: SapphireClient): void {
  const counts = Object.fromEntries([...client.stores.entries()].map(([name, store]) => [name, store.size]));

  logger.info({ pieces: counts }, "Piece stores loaded");

  const empty = (["commands", "listeners", "preconditions", "scheduled-tasks"] as const).filter(
    (name) => (counts[name] ?? 0) === 0,
  );

  if (empty.length > 0) {
    logger.fatal({ empty, counts }, "One or more piece stores loaded nothing");
    process.exit(1);
  }
}
