export interface BookSynopsis {
  text: string;
  url: string | undefined;
  language: string | undefined;
  source: "google_books" | "wikipedia";
}
