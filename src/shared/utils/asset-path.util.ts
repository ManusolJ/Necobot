import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ASSETS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "assets");

export function assetPath(...segments: string[]): string {
  return join(ASSETS_ROOT, ...segments);
}
