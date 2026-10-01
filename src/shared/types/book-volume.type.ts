export interface BookVolume {
  id: string;
  title: string;
  subtitle: string | undefined;
  authors: string[];
  publisher: string | undefined;
  publishedDate: string | undefined;
  description: string | undefined;
  pageCount: number | undefined;
  categories: string[];
  averageRating: number | undefined;
  ratingsCount: number | undefined;
  language: string | undefined;
  isbn: string | undefined;
  thumbnail: string | undefined;
  link: string | undefined;
}
