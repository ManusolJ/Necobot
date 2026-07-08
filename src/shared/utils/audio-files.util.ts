import { readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

const AUDIO_DIR = join(process.cwd(), "assets", "audio");

export const AUDIO_CHOICES: readonly { name: string; value: string }[] = readdirSync(AUDIO_DIR)
  .filter((file) => extname(file) === ".ogg")
  .slice(0, 25)
  .map((file) => ({
    name: prettifyName(file),
    value: file,
  }));

export function resolveAudioPath(fileName: string): string | undefined {
  const known = AUDIO_CHOICES.some((choice) => choice.value === fileName);
  return known ? join(AUDIO_DIR, basename(fileName)) : undefined;
}

function prettifyName(file: string): string {
  return basename(file, extname(file))
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
