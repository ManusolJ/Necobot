import type { BookVolume } from "./book-volume.type.js";

export interface EditionPick {
  work: BookVolume;
  related: BookVolume[];
  edition: BookVolume | undefined;
}
