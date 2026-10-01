export const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";

export const WIKIMEDIA_USER_AGENT = "Necobot/1.0 (https://github.com/ManusolJ/Necobot) By Manuel Soler Juan";

export const WIKIMEDIA_TIMEOUT_MS = 6_000;

export const WIKIDATA_WORK_CLASSES = [
  "Q7725634", // literary work
  "Q47461344", // written work
  "Q8261", // novel
  "Q571", // book
  "Q49084", // short story
  "Q1279564", // short story collection
  "Q12106333", // poetry collection
  "Q5185279", // poem
  "Q25379", // play
  "Q725377", // graphic novel
  "Q21198342", // manga series
] as const;

export const WIKIPEDIA_LANGUAGE_PATTERN = /^[a-z]{2,3}$/u;
