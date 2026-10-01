export const GOOGLE_BOOKS_API_BASE = "https://www.googleapis.com/books/v1";

export const GOOGLE_BOOKS_MAX_RESULTS = 20;

export const GOOGLE_BOOKS_TIMEOUT_MS = 8_000;

export const GOOGLE_BOOKS_ATTEMPTS = 3;

export const GOOGLE_BOOKS_RETRY_DELAY_MS = 750;

export const GOOGLE_BOOKS_ERROR_BODY_LOG_LIMIT = 500;

export const GOOGLE_BOOKS_FIELDS =
  "items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,pageCount,categories," +
  "averageRating,ratingsCount,language,infoLink,imageLinks/thumbnail,industryIdentifiers))";
