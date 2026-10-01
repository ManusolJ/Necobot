import type { BookSynopsis } from "./book-synopsis.type.js";

export interface BookDetails {
  title: string;
  authors: string[];
  categories: string[];
  isbn: string | undefined;
  link: string | undefined;
  subtitle: string | undefined;
  publisher: string | undefined;
  pageCount: number | undefined;
  thumbnail: string | undefined;
  ratingsCount: number | undefined;
  averageRating: number | undefined;
  publishedDate: string | undefined;
  synopsis: BookSynopsis | undefined;
  source: "google_books" | "wikipedia";
}
