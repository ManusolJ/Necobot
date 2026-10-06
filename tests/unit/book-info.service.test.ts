import type { BookVolume } from "@shared/types/book-volume.type.js";
import type { BookDetails } from "@shared/types/book-details.type.js";
import type { WorkSummary } from "@shared/types/work-summary.type.js";

import { BOOK_SYNOPSIS_MAX_LENGTH } from "@features/book-info/book-info.constants.js";
import {
  BOOK_NO_SYNOPSIS,
  BOOK_FOOTER_MIXED,
  BOOK_FOOTER_GOOGLE,
  BOOK_FOOTER_WIKIPEDIA,
} from "@features/book-info/book-info.messages.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

const searchVolumes = vi.hoisted(() => vi.fn());
const fetchWorkSummary = vi.hoisted(() => vi.fn());

vi.mock("@infrastructure/books/google-books.client.js", () => ({ searchVolumes }));
vi.mock("@infrastructure/wikipedia/wikipedia.client.js", () => ({ fetchWorkSummary }));

const { findBook, buildBookEmbed } = await import("@features/book-info/book-info.service.js");

const ES_SYNOPSIS =
  "Un amanecer de 1945, un muchacho es conducido por su padre a un misterioso lugar oculto en el corazón de la " +
  "ciudad vieja: el Cementerio de los Libros Olvidados. Allí encuentra un libro maldito que cambiará el rumbo " +
  "de su vida y lo arrastrará a un laberinto de intrigas y secretos.";

const EN_SYNOPSIS =
  "Barcelona, 1945. A boy is taken by his father to a secret place in the heart of the old city: the Cemetery " +
  "of Forgotten Books. There he finds a cursed book that changes the course of his life and drags him into a " +
  "labyrinth of intrigue and secrets that had been buried for years.";

const SUMMARY: WorkSummary = {
  title: "La sombra del viento (novela)",
  extract: "La sombra del viento es una novela de Carlos Ruiz Zafón publicada en 2001.",
  language: "es",
  url: "https://es.wikipedia.org/wiki/La_sombra_del_viento",
  thumbnail: "https://upload.wikimedia.org/sombra.jpg",
};

let nextId = 0;

function volume(overrides: Partial<BookVolume> = {}): BookVolume {
  nextId += 1;
  return {
    id: `v${String(nextId)}`,
    title: "La sombra del viento",
    subtitle: undefined,
    authors: ["Carlos Ruiz Zafón"],
    publisher: "Planeta",
    publishedDate: "2001-05-01",
    description: undefined,
    pageCount: 576,
    categories: ["Fiction"],
    averageRating: undefined,
    ratingsCount: undefined,
    language: "es",
    isbn: "9788408163381",
    thumbnail: undefined,
    link: "https://books.google.es/books?id=abc",
    ...overrides,
  };
}

function details(overrides: Partial<BookDetails> = {}): BookDetails {
  return {
    title: "La sombra del viento",
    subtitle: undefined,
    authors: ["Carlos Ruiz Zafón"],
    publisher: undefined,
    publishedDate: undefined,
    pageCount: undefined,
    categories: [],
    averageRating: undefined,
    ratingsCount: undefined,
    isbn: undefined,
    thumbnail: undefined,
    link: undefined,
    synopsis: { text: ES_SYNOPSIS, language: "es", source: "google_books", url: undefined },
    source: "google_books",
    ...overrides,
  };
}

const REQUEST = { title: "La sombra del viento", author: undefined, language: "es" };

beforeEach(() => {
  searchVolumes.mockReset();
  fetchWorkSummary.mockReset().mockResolvedValue(undefined);
});

describe("findBook", () => {
  // Normal case: a Spanish edition with a Spanish synopsis answers on its own, without asking Wikipedia.
  it("uses the synopsis of an edition in the user's language", async () => {
    searchVolumes.mockResolvedValue([volume(), volume({ description: ES_SYNOPSIS, publisher: "Booket" })]);

    const result = await findBook(REQUEST);

    expect(result).toMatchObject({
      status: "found",
      book: { publisher: "Booket", synopsis: { text: ES_SYNOPSIS, language: "es", source: "google_books" } },
    });
    expect(fetchWorkSummary).not.toHaveBeenCalled();
  });

  // The author option is part of the search, since Google's field operators are unusable.
  it("searches with the title and the author together", async () => {
    searchVolumes.mockResolvedValue([]);

    await findBook({ ...REQUEST, author: "Ruiz Zafón" });

    expect(searchVolumes).toHaveBeenCalledWith("La sombra del viento Ruiz Zafón");
  });

  // Regression: a special edition's title must not leak its edition notes into the embed title.
  it("titles the result after the best title match, not the special edition", async () => {
    searchVolumes.mockResolvedValue([
      volume(),
      volume({ title: "La sombra del viento (Edición conmemorativa)", description: ES_SYNOPSIS }),
    ]);

    const result = await findBook(REQUEST);

    expect(result.status === "found" && result.book.title).toBe("La sombra del viento");
  });

  // Regression: Spanish editions often append the English translation to the blurb.
  it("drops the English half of a bilingual blurb", async () => {
    searchVolumes.mockResolvedValue([volume({ description: `${ES_SYNOPSIS} ${EN_SYNOPSIS}` })]);

    const result = await findBook(REQUEST);

    expect(result.status === "found" && result.book.synopsis?.text).toBe(ES_SYNOPSIS);
  });

  // Fallback: no edition in the user's language, so the Wikipedia article in that language provides it.
  it("falls back to Wikipedia in the user's language", async () => {
    searchVolumes.mockResolvedValue([volume({ title: "The Shadow of the Wind (Movie Tie-in)", language: "en" })]);
    fetchWorkSummary.mockResolvedValue(SUMMARY);

    const result = await findBook({ ...REQUEST, title: "The Shadow of the Wind" });

    expect(fetchWorkSummary).toHaveBeenCalledWith("The Shadow of the Wind", "Carlos Ruiz Zafón", "es");
    expect(result).toMatchObject({
      status: "found",
      book: { source: "google_books", synopsis: { text: SUMMARY.extract, language: "es", source: "wikipedia" } },
    });
  });

  // Fallback: Google's cover wins, and Wikipedia's image only fills the gap.
  it("uses the Wikipedia image only when no edition has a cover", async () => {
    searchVolumes.mockResolvedValue([volume({ language: "en" })]);
    fetchWorkSummary.mockResolvedValue(SUMMARY);

    const result = await findBook(REQUEST);

    expect(result.status === "found" && result.book.thumbnail).toBe(SUMMARY.thumbnail);
  });

  // Fallback: with neither, a synopsis in another language beats none, labelled with its real language.
  it("falls back to a synopsis in another language", async () => {
    searchVolumes.mockResolvedValue([volume({ language: "en", description: EN_SYNOPSIS })]);

    const result = await findBook(REQUEST);

    expect(result).toMatchObject({ status: "found", book: { synopsis: { text: EN_SYNOPSIS, language: "en" } } });
  });

  it("finds the book even when no synopsis exists anywhere", async () => {
    searchVolumes.mockResolvedValue([volume()]);

    const result = await findBook(REQUEST);

    expect(result).toMatchObject({ status: "found", book: { title: "La sombra del viento", synopsis: undefined } });
  });

  it("reports not found when nothing matches the title", async () => {
    searchVolumes.mockResolvedValue([volume({ title: "Anales de literatura hispanoamericana" })]);

    expect(await findBook(REQUEST)).toEqual({ status: "not_found" });
  });

  // Resilience: Google Books is down, but Wikipedia still knows the book.
  it("answers from Wikipedia alone when Google Books is unavailable", async () => {
    searchVolumes.mockResolvedValue(undefined);
    fetchWorkSummary.mockResolvedValue(SUMMARY);

    const result = await findBook({ ...REQUEST, author: "Zafón" });

    expect(fetchWorkSummary).toHaveBeenCalledWith("La sombra del viento", "Zafón", "es");
    expect(result).toMatchObject({
      status: "found",
      book: { title: "La sombra del viento", authors: ["Zafón"], source: "wikipedia", link: SUMMARY.url },
    });
  });

  it("reports unavailable when both sources fail", async () => {
    searchVolumes.mockResolvedValue(undefined);

    expect(await findBook(REQUEST)).toEqual({ status: "unavailable" });
  });
});

describe("buildBookEmbed", () => {
  it("shows the bibliographic data as fields, with Spanish genre names", () => {
    const embed = buildBookEmbed(
      details({
        publisher: "Planeta",
        publishedDate: "2001-05-01",
        pageCount: 576,
        categories: ["Fiction / Literary", "Fiction / Thrillers", "Mystery"],
        averageRating: 4.5,
        ratingsCount: 34,
        isbn: "9788408163381",
      }),
      "es",
    ).toJSON();

    expect(embed.fields).toEqual([
      { name: "Autor", value: "Carlos Ruiz Zafón", inline: true },
      { name: "Edición", value: "Planeta (2001)", inline: true },
      { name: "Páginas", value: "576", inline: true },
      { name: "Género", value: "Ficción, Mystery", inline: true },
      { name: "Valoración", value: "4.5/5 (34 valoraciones)", inline: true },
      { name: "ISBN", value: "9788408163381", inline: true },
    ]);
  });

  it("leaves out fields it has no data for", () => {
    const embed = buildBookEmbed(details({ authors: ["Uno", "Dos"] }), "es").toJSON();

    expect(embed.fields).toEqual([{ name: "Autores", value: "Uno, Dos", inline: true }]);
  });

  it("links the title and shows the cover", () => {
    const embed = buildBookEmbed(
      details({ subtitle: "Novela", link: "https://books.google.es/x", thumbnail: "https://books.google.es/c" }),
      "es",
    ).toJSON();

    expect(embed).toMatchObject({
      title: "La sombra del viento: Novela",
      url: "https://books.google.es/x",
      thumbnail: { url: "https://books.google.es/c" },
      footer: { text: BOOK_FOOTER_GOOGLE },
    });
  });

  it("does not label a synopsis that is in the user's language", () => {
    expect(buildBookEmbed(details(), "es").toJSON().description).toBe(ES_SYNOPSIS);
  });

  // A synopsis in another language says so, naming the language in Spanish.
  it("labels a synopsis that is not in the user's language", () => {
    const embed = buildBookEmbed(details(), "fr").toJSON();

    expect(embed.description).toMatch(/^\*Sinopsis en español: /u);
    expect(embed.description).toContain(ES_SYNOPSIS);
  });

  // Attribution: Wikipedia text is CC BY-SA, so it links back to the article and the footer names the source.
  it("credits Wikipedia when the synopsis comes from it", () => {
    const synopsis = { text: SUMMARY.extract, language: "es", source: "wikipedia" as const, url: SUMMARY.url };
    const embed = buildBookEmbed(details({ synopsis }), "es").toJSON();

    expect(embed.description).toContain(`(${String(SUMMARY.url)})`);
    expect(embed.footer?.text).toBe(BOOK_FOOTER_MIXED);
  });

  it("names Wikipedia as the only source when Google Books was down", () => {
    expect(buildBookEmbed(details({ source: "wikipedia" }), "es").toJSON().footer?.text).toBe(BOOK_FOOTER_WIKIPEDIA);
  });

  // Long publisher blurbs are cut on a word boundary so the embed stays readable.
  it("truncates a long synopsis on a word boundary", () => {
    const long = Array.from({ length: 300 }, (_, index) => `palabra${String(index)}`).join(" ");
    const description =
      buildBookEmbed(
        details({ synopsis: { text: long, language: "es", source: "google_books", url: undefined } }),
        "es",
      ).toJSON().description ?? "";

    expect(description.length).toBeLessThanOrEqual(BOOK_SYNOPSIS_MAX_LENGTH);
    expect(description).toMatch(/palabra\d+…$/u);
  });

  it("says so when there is no synopsis", () => {
    expect(buildBookEmbed(details({ synopsis: undefined }), "es").toJSON().description).toBe(BOOK_NO_SYNOPSIS);
  });
});
