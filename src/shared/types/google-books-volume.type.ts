import type { GoogleBooksVolumeInfo } from "./google-books-volume-info.type.js";

export interface GoogleBooksVolume {
  id?: string;
  volumeInfo?: GoogleBooksVolumeInfo;
}
