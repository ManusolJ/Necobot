export const BOOK_NOT_FOUND =
  "No encontré ningún libro con ese título, nyaha~. Revisa cómo lo has escrito o dime también el autor.";

export const BOOK_UNAVAILABLE = "Las bibliotecas no me contestan ahora mismo. Prueba otra vez en un rato.";

export const BOOK_NO_SYNOPSIS = "No encontré la sinopsis de este libro.";

export const BOOK_FOREIGN_SYNOPSIS_NOTE = "*Sinopsis en {language}: no encontré ninguna en tu idioma.*";

export const BOOK_WIKIPEDIA_LINK = "[Leer más en Wikipedia]({url})";

export const BOOK_RATING_COUNT = "({count} valoraciones)";

export const BOOK_FIELD_LABELS = {
  isbn: "ISBN",
  author: "Autor",
  pages: "Páginas",
  authors: "Autores",
  edition: "Edición",
  categories: "Género",
  rating: "Valoración",
} as const;

export const BOOK_FOOTER_GOOGLE = "Datos: Google Books";

export const BOOK_FOOTER_MIXED = "Datos: Google Books · Sinopsis: Wikipedia";

export const BOOK_FOOTER_WIKIPEDIA = "Datos: Wikipedia";

export const BOOK_CATEGORY_NAMES: Readonly<Record<string, string>> = {
  Fiction: "Ficción",
  "Juvenile Fiction": "Ficción infantil",
  "Young Adult Fiction": "Ficción juvenil",
  "Juvenile Nonfiction": "Divulgación infantil",
  "Young Adult Nonfiction": "Divulgación juvenil",
  "Comics & Graphic Novels": "Cómic y novela gráfica",
  "Literary Collections": "Antologías",
  "Literary Criticism": "Crítica literaria",
  Poetry: "Poesía",
  Drama: "Teatro",
  Humor: "Humor",
  "Biography & Autobiography": "Biografía",
  History: "Historia",
  Philosophy: "Filosofía",
  Religion: "Religión",
  Psychology: "Psicología",
  Science: "Ciencia",
  "Social Science": "Ciencias sociales",
  "Political Science": "Política",
  "Business & Economics": "Economía y empresa",
  "Self-Help": "Autoayuda",
  "Body, Mind & Spirit": "Espiritualidad",
  "Health & Fitness": "Salud",
  "Family & Relationships": "Familia y relaciones",
  Education: "Educación",
  "Language Arts & Disciplines": "Lengua y lingüística",
  "Foreign Language Study": "Idiomas",
  Art: "Arte",
  Music: "Música",
  "Performing Arts": "Artes escénicas",
  Photography: "Fotografía",
  Cooking: "Cocina",
  Travel: "Viajes",
  "Sports & Recreation": "Deportes",
  Games: "Juegos",
  "Games & Activities": "Juegos",
  Computers: "Informática",
  Technology: "Tecnología",
  "Technology & Engineering": "Tecnología e ingeniería",
  Mathematics: "Matemáticas",
  Medical: "Medicina",
  Law: "Derecho",
  "True Crime": "Crímenes reales",
  Nature: "Naturaleza",
};
