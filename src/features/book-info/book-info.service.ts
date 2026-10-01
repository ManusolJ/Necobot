import { searchVolumes } from "@infrastructure/books/google-books.client.js";
import { fetchWorkSummary } from "@infrastructure/wikipedia/wikipedia.client.js";

import type { BookLookup } from "@shared/types/book-lookup.type.js";
import type { BookVolume } from "@shared/types/book-volume.type.js";
import type { BookDetails } from "@shared/types/book-details.type.js";
import type { BookRequest } from "@shared/types/book-request.type.js";
import type { WorkSummary } from "@shared/types/work-summary.type.js";
import type { EditionPick } from "@shared/types/edition-pick.type.js";
import type { BookSynopsis } from "@shared/types/book-synopsis.type.js";

import { EMBED_COLOR } from "@shared/consts/branding.constants.js";
import { formatMessage } from "@shared/utils/format-message.util.js";

import {
  BOOK_CATEGORY_LIMIT,
  EMBED_TITLE_MAX_LENGTH,
  EMBED_FIELD_MAX_LENGTH,
  BOOK_SYNOPSIS_MAX_LENGTH,
} from "./book-info.constants.js";
import {
  pickEdition,
  trimToLanguage,
  primaryLanguage,
  stripEditionNotes,
  preferredDescription,
  detectSynopsisLanguage,
} from "./book-match.util.js";
import {
  BOOK_NO_SYNOPSIS,
  BOOK_FIELD_LABELS,
  BOOK_FOOTER_MIXED,
  BOOK_CATEGORY_NAMES,
  BOOK_RATING_COUNT,
  BOOK_FOOTER_GOOGLE,
  BOOK_WIKIPEDIA_LINK,
  BOOK_FOOTER_WIKIPEDIA,
  BOOK_FOREIGN_SYNOPSIS_NOTE,
} from "./book-info.messages.js";

import type { APIEmbedField } from "discord.js";

import { EmbedBuilder } from "discord.js";

const LANGUAGE_NAMES = new Intl.DisplayNames(["es"], { type: "language" });

function googleSynopsis(volume: BookVolume, description: string): BookSynopsis {
  const language = detectSynopsisLanguage(description) ?? primaryLanguage(volume.language);

  return {
    text: language ? trimToLanguage(description, language) : description,
    language,
    source: "google_books",
    url: volume.link,
  };
}

function wikipediaSynopsis(summary: WorkSummary): BookSynopsis {
  return { text: summary.extract, language: summary.language, source: "wikipedia", url: summary.url };
}

function toDetails(volume: BookVolume, pick: EditionPick, synopsis: BookSynopsis | undefined): BookDetails {
  return {
    title: stripEditionNotes(pick.work.title),
    subtitle: pick.work.subtitle,
    authors: volume.authors,
    publisher: volume.publisher,
    publishedDate: volume.publishedDate,
    pageCount: volume.pageCount,
    categories: volume.categories,
    averageRating: volume.averageRating,
    ratingsCount: volume.ratingsCount,
    isbn: volume.isbn,
    thumbnail: volume.thumbnail ?? pick.related.find((candidate) => candidate.thumbnail)?.thumbnail,
    link: volume.link,
    synopsis,
    source: "google_books",
  };
}

function fromSummary(summary: WorkSummary, request: BookRequest): BookDetails {
  return {
    title: stripEditionNotes(summary.title),
    subtitle: undefined,
    authors: request.author ? [request.author] : [],
    publisher: undefined,
    publishedDate: undefined,
    pageCount: undefined,
    categories: [],
    averageRating: undefined,
    ratingsCount: undefined,
    isbn: undefined,
    thumbnail: summary.thumbnail,
    link: summary.url,
    synopsis: wikipediaSynopsis(summary),
    source: "wikipedia",
  };
}

export async function findBook(request: BookRequest): Promise<BookLookup> {
  const volumes = await searchVolumes([request.title, request.author].filter(Boolean).join(" "));

  if (volumes === undefined) {
    const summary = await fetchWorkSummary(request.title, request.author, request.language);
    return summary ? { status: "found", book: fromSummary(summary, request) } : { status: "unavailable" };
  }

  const pick = pickEdition(volumes, request);

  if (!pick) {
    return { status: "not_found" };
  }

  if (pick.edition?.description) {
    const synopsis = googleSynopsis(pick.edition, pick.edition.description);
    return { status: "found", book: toDetails(pick.edition, pick, synopsis) };
  }

  const summary = await fetchWorkSummary(
    stripEditionNotes(pick.work.title),
    pick.work.authors[0] ?? request.author,
    request.language,
  );
  const fallback = preferredDescription(pick.related);
  const synopsis = summary
    ? wikipediaSynopsis(summary)
    : fallback && googleSynopsis(fallback.volume, fallback.description);
  const book = toDetails(pick.work, pick, synopsis);

  return { status: "found", book: { ...book, thumbnail: book.thumbnail ?? summary?.thumbnail } };
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function languageName(code: string): string {
  try {
    return LANGUAGE_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

function describeSynopsis(synopsis: BookSynopsis | undefined, language: string): string {
  if (!synopsis) {
    return BOOK_NO_SYNOPSIS;
  }

  const parts = [truncate(synopsis.text, BOOK_SYNOPSIS_MAX_LENGTH)];

  if (synopsis.language && synopsis.language !== language) {
    parts.unshift(formatMessage(BOOK_FOREIGN_SYNOPSIS_NOTE, { language: languageName(synopsis.language) }));
  }

  if (synopsis.source === "wikipedia" && synopsis.url) {
    parts.push(formatMessage(BOOK_WIKIPEDIA_LINK, { url: synopsis.url }));
  }

  return parts.join("\n\n");
}

function categoryNames(categories: string[]): string[] {
  const names = categories.map((category) => {
    const topLevel = category.split(" / ")[0]?.trim() ?? category;
    return BOOK_CATEGORY_NAMES[topLevel] ?? topLevel;
  });

  return [...new Set(names)].slice(0, BOOK_CATEGORY_LIMIT);
}

function buildFields(book: BookDetails): APIEmbedField[] {
  const year = book.publishedDate?.slice(0, 4);
  const edition = [book.publisher, year && `(${year})`].filter(Boolean).join(" ");
  const rating =
    book.averageRating === undefined
      ? undefined
      : [
          `${String(book.averageRating)}/5`,
          book.ratingsCount ? formatMessage(BOOK_RATING_COUNT, { count: book.ratingsCount }) : undefined,
        ]
          .filter(Boolean)
          .join(" ");

  const fields: [string, string | undefined][] = [
    [
      book.authors.length > 1 ? BOOK_FIELD_LABELS.authors : BOOK_FIELD_LABELS.author,
      book.authors.join(", ") || undefined,
    ],
    [BOOK_FIELD_LABELS.edition, edition || undefined],
    [BOOK_FIELD_LABELS.pages, book.pageCount ? String(book.pageCount) : undefined],
    [BOOK_FIELD_LABELS.categories, categoryNames(book.categories).join(", ") || undefined],
    [BOOK_FIELD_LABELS.rating, rating],
    [BOOK_FIELD_LABELS.isbn, book.isbn],
  ];

  return fields.flatMap(([name, value]) =>
    value ? [{ name, value: truncate(value, EMBED_FIELD_MAX_LENGTH), inline: true }] : [],
  );
}

function footerText(book: BookDetails): string {
  if (book.source === "wikipedia") {
    return BOOK_FOOTER_WIKIPEDIA;
  }

  return book.synopsis?.source === "wikipedia" ? BOOK_FOOTER_MIXED : BOOK_FOOTER_GOOGLE;
}

export function buildBookEmbed(book: BookDetails, language: string): EmbedBuilder {
  const title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(truncate(title, EMBED_TITLE_MAX_LENGTH))
    .setDescription(describeSynopsis(book.synopsis, language))
    .addFields(buildFields(book))
    .setFooter({ text: footerText(book) });

  if (book.link) {
    embed.setURL(book.link);
  }

  if (book.thumbnail) {
    embed.setThumbnail(book.thumbnail);
  }

  return embed;
}
