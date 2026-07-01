export function formatMessage(template: string, replacements: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}
