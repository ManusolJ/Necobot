import type { BookVolume } from "@shared/types/book-volume.type.js";
import type { BookRequest } from "@shared/types/book-request.type.js";

import {
  pickEdition,
  detectLanguage,
  trimToLanguage,
  primaryLanguage,
  stripEditionNotes,
  preferredDescription,
  detectSynopsisLanguage,
} from "@features/book-info/book-match.util.js";

import { describe, expect, it } from "vitest";

const ES_SYNOPSIS =
  "Robert Langdon recibe una llamada en mitad de la noche: el conservador del museo del Louvre ha sido asesinado " +
  "y junto a su cadáver aparece un mensaje cifrado. Con la ayuda de Sophie Neveu sigue las pistas por París y " +
  "descubre una sociedad secreta que guarda un secreto desde hace siglos.";

const EN_SYNOPSIS =
  "Robert Langdon receives a call in the middle of the night: the curator of the Louvre has been murdered and " +
  "a coded message lies next to his body. With the help of Sophie Neveu he follows the clues through Paris and " +
  "uncovers a secret society that has kept its secret for centuries.";

let nextId = 0;

function volume(overrides: Partial<BookVolume> = {}): BookVolume {
  nextId += 1;
  return {
    id: `v${String(nextId)}`,
    title: "El código Da Vinci",
    subtitle: undefined,
    authors: ["Dan Brown"],
    publisher: undefined,
    publishedDate: undefined,
    description: undefined,
    pageCount: undefined,
    categories: [],
    averageRating: undefined,
    ratingsCount: undefined,
    language: "es",
    isbn: undefined,
    thumbnail: undefined,
    link: undefined,
    ...overrides,
  };
}

function request(title: string, overrides: Partial<BookRequest> = {}): BookRequest {
  return { title, author: undefined, language: "es", ...overrides };
}

describe("primaryLanguage", () => {
  // Discord sends regional locales; Google Books and Wikipedia only care about the language itself.
  it("reduces a Discord locale to its language", () => {
    expect(primaryLanguage("es-ES")).toBe("es");
    expect(primaryLanguage("es-419")).toBe("es");
    expect(primaryLanguage("pt-BR")).toBe("pt");
    expect(primaryLanguage("fr")).toBe("fr");
    expect(primaryLanguage(undefined)).toBeUndefined();
  });
});

describe("stripEditionNotes", () => {
  it("drops bracketed notes and the second title of bilingual editions", () => {
    expect(
      stripEditionNotes(
        "Harry Potter Y La Piedra Filosofal (Edición Especial) / Harry Potter and the Sorcerer's Stone (Special Edition)",
      ),
    ).toBe("Harry Potter Y La Piedra Filosofal");
    expect(stripEditionNotes("El nombre del viento (Crónica del asesino de reyes 1)")).toBe("El nombre del viento");
  });

  // Edge case: a title that is nothing but brackets must not collapse to an empty string.
  it("keeps the title when stripping would leave nothing", () => {
    expect(stripEditionNotes("(1984)")).toBe("(1984)");
  });
});

describe("detectLanguage", () => {
  it("recognises Spanish and English prose", () => {
    expect(detectLanguage(ES_SYNOPSIS)).toBe("es");
    expect(detectLanguage(EN_SYNOPSIS)).toBe("en");
  });

  // Edge case: a couple of words are not enough evidence, so the caller falls back to trusting the label.
  it("gives up on text too short to tell", () => {
    expect(detectLanguage("Rayuela")).toBeUndefined();
  });
});

describe("detectSynopsisLanguage", () => {
  // Regression: in a short bilingual blurb the English half can outweigh the Spanish, but it opens in Spanish.
  it("reads the language from the opening of a bilingual blurb", () => {
    expect(detectSynopsisLanguage(`${ES_SYNOPSIS} ${EN_SYNOPSIS}`)).toBe("es");
  });

  it("recognises a description that is entirely in another language", () => {
    expect(detectSynopsisLanguage(EN_SYNOPSIS)).toBe("en");
  });

  it("gives up when no sentence is conclusive", () => {
    expect(detectSynopsisLanguage("Rayuela. 1963.")).toBeUndefined();
  });
});

describe("trimToLanguage", () => {
  // Normal case: the Spanish blurb of a Spanish edition often continues with its English translation.
  it("cuts a bilingual blurb where the other language starts", () => {
    expect(trimToLanguage(`${ES_SYNOPSIS} ${EN_SYNOPSIS}`, "es")).toBe(ES_SYNOPSIS);
  });

  it("leaves a single-language text untouched", () => {
    expect(trimToLanguage(ES_SYNOPSIS, "es")).toBe(ES_SYNOPSIS);
  });

  // Edge case: the opening sentence is always kept, even in another language, so the result is never empty.
  it("keeps the first sentence whatever its language", () => {
    expect(trimToLanguage(EN_SYNOPSIS, "es").length).toBeGreaterThan(0);
  });
});

describe("preferredDescription", () => {
  // A one-line catalogue entry is a worse synopsis than a full blurb further down the list.
  it("prefers a description of real length over an earlier one-liner", () => {
    const short = volume({ description: "Novela de misterio." });
    const full = volume({ description: ES_SYNOPSIS });

    expect(preferredDescription([short, full])?.volume).toBe(full);
  });

  // Special editions open their blurb by selling the edition, so a standard edition wins when both qualify.
  it("prefers a standard edition over a special one", () => {
    const special = volume({ title: "El código Da Vinci (Edición especial)", description: ES_SYNOPSIS });
    const standard = volume({ description: ES_SYNOPSIS });

    expect(preferredDescription([special, standard])?.volume).toBe(standard);
  });

  it("falls back to Google's order when nothing else separates them", () => {
    const first = volume({ description: ES_SYNOPSIS });
    const second = volume({ description: `${ES_SYNOPSIS} Más.` });

    expect(preferredDescription([first, second])?.volume).toBe(first);
  });

  it("returns undefined when no volume has a description", () => {
    expect(preferredDescription([volume()])).toBeUndefined();
  });
});

describe("pickEdition", () => {
  // Normal case: the Spanish edition with a Spanish synopsis is chosen even when Google lists others first.
  it("picks the edition with a synopsis in the requested language", () => {
    const bare = volume();
    const english = volume({ language: "en", description: EN_SYNOPSIS });
    const spanish = volume({ description: ES_SYNOPSIS });

    expect(pickEdition([bare, english, spanish], request("El código Da Vinci"))?.edition).toBe(spanish);
  });

  // Regression: companion books share the novel's exact title but appear once, the novel in many editions.
  it("prefers the book with more editions over a same-titled companion listed first", () => {
    const companion = volume({
      title: "El Codigo Da Vinci",
      subtitle: "En busca de respuestas",
      authors: ["Josh McDowell"],
    });
    const novel = [volume(), volume({ description: ES_SYNOPSIS }), volume()];

    const pick = pickEdition([companion, ...novel], request("El código Da Vinci"));

    expect(pick?.work.authors).toEqual(["Dan Brown"]);
    expect(pick?.related).toHaveLength(3);
  });

  // Regression: an author-less entry would otherwise count as an edition of every same-titled book.
  it("does not let an entry without authors win on edition count", () => {
    const anonymous = volume({ title: "Rayuela", subtitle: "Una muestra para armar", authors: [] });
    const novel = [
      volume({ title: "Rayuela", authors: ["Julio Cortázar"] }),
      volume({ title: "Rayuela", authors: ["Julio Cortázar"] }),
    ];

    expect(pickEdition([anonymous, ...novel], request("Rayuela"))?.work.authors).toEqual(["Julio Cortázar"]);
  });

  it("skips packs and study guides", () => {
    const guide = volume({ title: "El código Da Vinci de Dan Brown (Guía de lectura)", description: ES_SYNOPSIS });
    const pack = volume({ title: "Pack El código Da Vinci + Ángeles y demonios", description: ES_SYNOPSIS });
    const novel = volume({ description: ES_SYNOPSIS });

    expect(pickEdition([guide, pack, novel], request("El código Da Vinci"))?.edition).toBe(novel);
  });

  // Edge case: someone actually looking for a reading guide should still get one.
  it("keeps study guides when the search asks for one", () => {
    const guide = volume({ title: "El código Da Vinci (Guía de lectura)", description: ES_SYNOPSIS });

    expect(pickEdition([guide], request("Guía de lectura El código Da Vinci"))?.edition).toBe(guide);
  });

  // Regression: a Spanish edition can carry an English library blurb, which must not pass as a Spanish synopsis.
  it("ignores a Spanish edition whose description is in English", () => {
    const mislabelled = volume({ description: EN_SYNOPSIS });

    const pick = pickEdition([mislabelled], request("El código Da Vinci"));

    expect(pick?.work).toBe(mislabelled);
    expect(pick?.edition).toBeUndefined();
  });

  // Edge case: the requested language has no edition, so the caller has to look elsewhere for a synopsis.
  it("leaves the edition empty when no edition is in the requested language", () => {
    const pick = pickEdition([volume({ description: ES_SYNOPSIS })], request("El código Da Vinci", { language: "fr" }));

    expect(pick?.work).toBeDefined();
    expect(pick?.edition).toBeUndefined();
  });

  // Edge case: the same title by another author is a different book and lends it no synopsis.
  it("does not borrow the synopsis of a same-titled book by someone else", () => {
    const novel = volume({ title: "It", authors: ["Stephen King"] });
    const other = volume({ title: "It", authors: ["Alexa Chung"], description: ES_SYNOPSIS });

    const pick = pickEdition([novel, other], request("It", { author: "Stephen King" }));

    expect(pick?.work).toBe(novel);
    expect(pick?.edition).toBeUndefined();
  });

  // The author option outranks Google's order when the title alone is ambiguous.
  it("prefers the requested author", () => {
    const other = volume({ title: "It", authors: ["Alexa Chung"] });
    const king = volume({ title: "It", authors: ["Stephen King"] });

    expect(pickEdition([other, king], request("It", { author: "King" }))?.work).toBe(king);
  });

  // Edge case: a slightly mistyped title still finds the book through prefix matching.
  it("tolerates a truncated word", () => {
    const novel = volume({ title: "Rayuela", authors: ["Julio Cortázar"] });

    expect(pickEdition([novel], request("rayuel"))?.work).toBe(novel);
  });

  // Edge case: Google always returns something; results unrelated to the title must read as "not found".
  it("returns undefined when no result matches the title", () => {
    expect(pickEdition([volume({ title: "Revista de crítica literaria" })], request("asdkjhqwe zzqx"))).toBeUndefined();
  });

  it("returns undefined for an empty result list", () => {
    expect(pickEdition([], request("Rayuela"))).toBeUndefined();
  });
});
