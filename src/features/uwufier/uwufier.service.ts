import { logger } from "@infrastructure/config/logger.config.js";

import { PROVIDER, UWUFIER_URL, UWUFY_TIMEOUT_MS } from "./uwufier.constants.js";

const PRESERVED_PATTERN =
  /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<a?:\w+:\d+>|<\/[\w -]+:\d+>|<t:\d+(?::[tTdDfFR])?>|<@[!&]?\d+>|<#\d+>/gu;

const PLACEHOLDER_PATTERN = /\{\{\d+\}\}/gu;

function placeholderFor(index: number): string {
  return `{{${String(index)}}}`;
}

function maskPreserved(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];

  const masked = text.replace(PRESERVED_PATTERN, (match) => {
    tokens.push(match);
    return placeholderFor(tokens.length - 1);
  });

  return { masked, tokens };
}

function restorePreserved(text: string, tokens: readonly string[]): string | undefined {
  let result = text;

  for (const [index, token] of tokens.entries()) {
    const placeholder = placeholderFor(index);

    if (!result.includes(placeholder)) {
      logger.error({ placeholder }, "Uwufier dropped a preserved span; leaving the message alone");
      return undefined;
    }

    result = result.replace(placeholder, () => token);
  }

  return result;
}

function hasRewritableText(masked: string): boolean {
  return /\p{L}/u.test(masked.replace(PLACEHOLDER_PATTERN, ""));
}

async function requestUwu(text: string): Promise<string | undefined> {
  try {
    const response = await fetch(UWUFIER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: PROVIDER, text }),
      signal: AbortSignal.timeout(UWUFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "Uwufier request failed");
      return undefined;
    }

    const data = (await response.json()) as { uwu?: string };
    const uwu = data.uwu?.trim();

    return uwu === undefined || uwu === "" ? undefined : uwu;
  } catch (error) {
    logger.error({ err: error }, "Uwufier request errored");
    return undefined;
  }
}

export async function uwuifyText(text: string): Promise<string | undefined> {
  const { masked, tokens } = maskPreserved(text);

  if (!hasRewritableText(masked)) {
    return undefined;
  }

  const rewritten = await requestUwu(masked);

  if (rewritten === undefined) {
    return undefined;
  }

  return restorePreserved(rewritten, tokens);
}
