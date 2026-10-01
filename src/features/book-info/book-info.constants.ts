export const BOOK_QUERY_MAX_LENGTH = 200;

export const BOOK_DEFAULT_LANGUAGE = "es";

export const BOOK_SYNOPSIS_MAX_LENGTH = 1_000;

export const BOOK_CATEGORY_LIMIT = 2;

export const EMBED_TITLE_MAX_LENGTH = 256;

export const EMBED_FIELD_MAX_LENGTH = 1_024;

export const BOOK_MIN_TITLE_COVERAGE = 0.5;

export const BOOK_FUZZY_TOKEN_MIN_LENGTH = 4;

export const BOOK_AUTHOR_TOKEN_MIN_LENGTH = 3;

export const BOOK_DERIVATIVE_PATTERN =
  /\b(?:pack|estuche|box(?:ed)? set|trilogia|trilogy|guia de (?:lectura|estudio)|study guide|resumen|summary|analisis|analysis|sparknotes|cliffsnotes|descodificado|decoded)\b/u;

export const BOOK_MIN_SYNOPSIS_LENGTH = 200;

export const BOOK_MIN_LANGUAGE_HITS = 3;

export const BOOK_MIN_SENTENCE_LANGUAGE_HITS = 2;

export const BOOK_LANGUAGE_STOPWORDS: Readonly<Record<string, ReadonlySet<string>>> = {
  es: new Set(["el", "los", "las", "del", "una", "por", "con", "para", "su", "sus", "y", "es", "pero", "muy"]),
  en: new Set(["the", "and", "of", "to", "his", "her", "with", "for", "that", "is", "was", "it", "by", "from"]),
  pt: new Set(["o", "os", "do", "da", "dos", "das", "um", "uma", "com", "nao", "ao", "em", "na", "seu", "sua"]),
  fr: new Set(["le", "les", "des", "du", "une", "et", "est", "dans", "pour", "qui", "sur", "au", "aux", "elle"]),
  de: new Set(["der", "die", "das", "und", "ist", "nicht", "mit", "ein", "eine", "den", "von", "zu", "sich", "dem"]),
  it: new Set(["il", "gli", "della", "che", "per", "non", "sono", "nella", "di", "nel", "degli", "alla", "delle"]),
};
