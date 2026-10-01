export interface GoogleBooksVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  language?: string;
  infoLink?: string;
  imageLinks?: { thumbnail?: string };
  industryIdentifiers?: { type?: string; identifier?: string }[];
}
