import type { BookDetails } from "./book-details.type.js";

export type BookLookup = { status: "found"; book: BookDetails } | { status: "not_found" } | { status: "unavailable" };
