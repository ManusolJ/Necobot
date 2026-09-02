import type { PieceType } from "@shared/types/piece.type.js";

import { generatePiece, missingNameUsage, parseArgs, PIECE_TYPES, readStringFlag } from "./generator.js";

import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const TOOLS = {
  eslint: join(repoRoot, "node_modules", "eslint", "bin", "eslint.js"),
  prettier: join(repoRoot, "node_modules", "prettier", "bin", "prettier.cjs"),
};

function write(stream: "stdout" | "stderr", message: string): void {
  process[stream].write(`${message}\n`);
}

function formatGenerated(relativePath: string): boolean {
  const steps: [string, string[]][] = [
    [TOOLS.eslint, ["--fix", relativePath]],
    [TOOLS.prettier, ["--write", "--log-level", "warn", relativePath]],
  ];

  for (const [tool, args] of steps) {
    if (!existsSync(tool)) {
      write("stderr", `! Skipped formatting: ${tool} not found. Run npm install.`);
      return false;
    }

    const result = spawnSync(process.execPath, [tool, ...args], { cwd: repoRoot, encoding: "utf8" });

    if (result.status !== 0) {
      write("stderr", `! ${tool.includes("eslint") ? "eslint" : "prettier"} reported a problem:`);
      write("stderr", (result.stdout ?? "") + (result.stderr ?? ""));
      return false;
    }
  }

  return true;
}

function nextSteps(type: PieceType, pieceName: string): string[] {
  if (type === "command") {
    return [
      `Add /${pieceName} to INFO_COMMAND_GROUPS in src/features/information/information.constants.ts`,
      "(the /info drift test fails until you do)",
    ];
  }

  if (type === "precondition") {
    return [`Use it with preconditions: ["${pieceName}"] in a command`];
  }

  return ["Adjust the event and run signature if needed"];
}

function main(): number {
  const [typeArg, ...rest] = process.argv.slice(2);

  if (typeArg === undefined || !PIECE_TYPES.includes(typeArg as PieceType)) {
    write("stderr", `Usage: npm run g:<${PIECE_TYPES.join("|")}> -- [--feature <name>] [--event <Event>] <name>`);
    return 1;
  }

  const type = typeArg as PieceType;
  const { positionals, flags } = parseArgs(rest);
  const name = positionals[0];

  if (name === undefined) {
    write("stderr", "Missing name.");
    write("stderr", `  ${missingNameUsage(type, flags)}`);

    if (type === "listener") {
      write("stderr", "  Listeners are named for what they do, not for their feature (mention-reply, vision-warmup).");
    }

    return 1;
  }

  let piece;

  try {
    piece = generatePiece({
      name,
      type,
      feature: readStringFlag(flags, "feature"),
      event: readStringFlag(flags, "event"),
    });
  } catch (error) {
    write("stderr", error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (flags.has("dry-run")) {
    write("stdout", `--- ${piece.path} ---`);
    write("stdout", piece.contents);
    return 0;
  }

  const absolutePath = join(repoRoot, piece.path);

  if (existsSync(absolutePath) && !flags.has("force")) {
    write("stderr", `${piece.path} already exists. Pass --force to overwrite.`);
    return 1;
  }

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, piece.contents, "utf8");

  const formatted = flags.has("no-lint") || formatGenerated(piece.path);

  write("stdout", `✓ Created ${piece.path}`);
  write("stdout", `  ${piece.className}`);

  for (const step of nextSteps(type, piece.pieceName)) {
    write("stdout", `  → ${step}`);
  }

  return formatted ? 0 : 1;
}

process.exit(main());
