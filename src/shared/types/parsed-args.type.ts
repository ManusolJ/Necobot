export type ParsedArgs = {
  positionals: string[];
  flags: Map<string, string | true>;
};
