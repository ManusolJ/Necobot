import {
  parseArgs,
  PIECE_TYPES,
  toKebabCase,
  toPascalCase,
  generatePiece,
  DEFAULT_EVENT,
  readStringFlag,
  resolveTargetPath,
  missingNameUsage,
} from "../../scripts/generator.js";

import { describe, expect, it } from "vitest";

describe("toKebabCase", () => {
  // Normal case: the common input is already kebab and must survive untouched.
  it("leaves a kebab name alone", () => {
    expect(toKebabCase("monster-time")).toBe("monster-time");
  });

  // Normal case: a Pascal name typed by habit has to split on its capitals.
  it("splits a pascal name on its capitals", () => {
    expect(toKebabCase("MonsterTime")).toBe("monster-time");
  });

  // Edge case: underscores and spaces are plausible typos that should normalise rather than fail.
  it("normalises underscores and spaces", () => {
    expect(toKebabCase("monster_time")).toBe("monster-time");
    expect(toKebabCase("monster time")).toBe("monster-time");
  });

  // Edge case: stray separators must not leave doubled or dangling hyphens in a filename.
  it("collapses repeated and trailing separators", () => {
    expect(toKebabCase("--monster__time--")).toBe("monster-time");
  });

  // Edge case: digits belong to the word they follow, so a name like this stays one segment.
  it("keeps digits attached to their word", () => {
    expect(toKebabCase("rps2")).toBe("rps2");
  });
});

describe("toPascalCase", () => {
  // Normal case: a kebab name becomes the class name prefix.
  it("builds a pascal name from kebab", () => {
    expect(toPascalCase("monster-time")).toBe("MonsterTime");
  });

  // Normal case: an already-pascal name round-trips unchanged.
  it("leaves a pascal name alone", () => {
    expect(toPascalCase("MonsterTime")).toBe("MonsterTime");
  });

  // Edge case: an empty string has no words, so it must produce an empty result rather than throw.
  it("returns an empty string for empty input", () => {
    expect(toPascalCase("")).toBe("");
  });
});

describe("resolveTargetPath", () => {
  // Normal case: commands always live inside a feature's commands folder.
  it("puts a command in its feature", () => {
    expect(resolveTargetPath("command", "shop", "economy")).toBe("src/features/economy/commands/shop.command.ts");
  });

  // Normal case: listeners and preconditions default to shared when no feature is given.
  it("defaults a listener and a precondition to shared", () => {
    expect(resolveTargetPath("listener", "welcome")).toBe("src/shared/listeners/welcome.listener.ts");
    expect(resolveTargetPath("precondition", "owner-has-role")).toBe(
      "src/shared/preconditions/owner-has-role.precondition.ts",
    );
  });

  // Normal case: a listener can also be scoped to a feature when it belongs to one.
  it("puts a listener in a feature when asked", () => {
    expect(resolveTargetPath("listener", "welcome", "economy")).toBe(
      "src/features/economy/listeners/welcome.listener.ts",
    );
  });

  // Error handling: a command has no sensible shared location, so the missing feature must be rejected.
  it("refuses a command with no feature", () => {
    expect(() => resolveTargetPath("command", "shop")).toThrow(/--feature/u);
  });

  // Error handling: a feature name containing path segments could write outside src, so it is rejected.
  it("rejects a feature name that escapes the tree", () => {
    expect(() => resolveTargetPath("listener", "welcome", "../../etc")).toThrow(/Invalid feature name/u);
  });
});

describe("generatePiece", () => {
  // Normal case: a command lands at the right path with a matching class and slash name.
  it("generates a command", () => {
    const piece = generatePiece({ type: "command", name: "shop", feature: "economy" });

    expect(piece.path).toBe("src/features/economy/commands/shop.command.ts");
    expect(piece.className).toBe("ShopCommand");
    expect(piece.pieceName).toBe("shop");
    expect(piece.contents).toContain('.setName("shop")');
    expect(piece.contents).toContain("export class ShopCommand extends Command");
  });

  // Most features here are named after their single command, so omitting --feature starts one.
  it("defaults a command's feature to its own name", () => {
    expect(generatePiece({ type: "command", name: "slap" }).path).toBe("src/features/slap/commands/slap.command.ts");
  });

  // Edge case: the defaulted feature folder must use the kebab form, not the raw input.
  it("uses the kebab name when defaulting the feature", () => {
    expect(generatePiece({ type: "command", name: "MonsterTime" }).path).toBe(
      "src/features/monster-time/commands/monster-time.command.ts",
    );
  });

  // An explicit feature must still win, so a command can join an existing feature.
  it("prefers an explicit feature over the default", () => {
    expect(generatePiece({ type: "command", name: "shop", feature: "economy" }).path).toBe(
      "src/features/economy/commands/shop.command.ts",
    );
  });

  // The default is command-only: listeners and preconditions still belong in shared by default.
  it("does not default the feature for listeners or preconditions", () => {
    expect(generatePiece({ type: "listener", name: "welcome" }).path).toBe("src/shared/listeners/welcome.listener.ts");
    expect(generatePiece({ type: "precondition", name: "OwnerHasRole" }).path).toBe(
      "src/shared/preconditions/owner-has-role.precondition.ts",
    );
  });

  // Normal case: generated commands inherit the repo's default precondition pair.
  it("wires the default preconditions onto a command", () => {
    const piece = generatePiece({ type: "command", name: "shop", feature: "economy" });

    expect(piece.contents).toContain('preconditions: ["GuildConfigured", "NotExcluded"]');
  });

  // Edge case: a multi-word name has to become kebab in the file and slash name, pascal in the class.
  it("splits a multi-word command name correctly", () => {
    const piece = generatePiece({ type: "command", name: "MonsterTime", feature: "vision" });

    expect(piece.path).toBe("src/features/vision/commands/monster-time.command.ts");
    expect(piece.className).toBe("MonsterTimeCommand");
    expect(piece.contents).toContain('.setName("monster-time")');
  });

  // Edge case: typing the suffix yourself must not double it into ShopCommandCommand.
  it("does not double a suffix the caller already typed", () => {
    expect(generatePiece({ type: "command", name: "shop-command", feature: "economy" }).className).toBe("ShopCommand");
    expect(generatePiece({ type: "listener", name: "WelcomeListener" }).className).toBe("WelcomeListener");
  });

  // Normal case: a known event gets a readable named parameter that the stub body actually uses.
  it("generates a listener with a named parameter for a known event", () => {
    const piece = generatePiece({ type: "listener", name: "welcome", event: "GuildMemberAdd" });

    expect(piece.contents).toContain("run(member: GuildMember): void");
    expect(piece.contents).toContain("userId: member.id");
    expect(piece.contents).toContain('import type { GuildMember } from "discord.js"');
  });

  // Edge case: an unmapped event falls back to the indexed tuple, which compiles for any real event.
  it("falls back to the indexed signature for an unmapped event", () => {
    const piece = generatePiece({ type: "listener", name: "metrics", event: "ChatInputCommandFinish" });

    expect(piece.contents).toContain("..._args: ClientEvents[typeof Events.ChatInputCommandFinish]");
    expect(piece.contents).toContain('import type { ClientEvents } from "discord.js"');
  });

  // Edge case: ClientReady takes no arguments, so the stub must not invent a parameter.
  it("generates a no-argument listener for ClientReady", () => {
    const piece = generatePiece({ type: "listener", name: "warmup", event: "ClientReady" });

    expect(piece.contents).toContain("run(): void");
    expect(piece.contents).not.toContain('from "discord.js"');
  });

  // Normal case: listeners default to the most common event when none is passed.
  it("defaults a listener to the default event", () => {
    expect(generatePiece({ type: "listener", name: "welcome" }).contents).toContain(`Events.${DEFAULT_EVENT}`);
  });

  // Normal case: the precondition template must emit the module augmentation and the matching name.
  it("generates a precondition with its module augmentation", () => {
    const piece = generatePiece({ type: "precondition", name: "owner-has-role" });

    expect(piece.path).toBe("src/shared/preconditions/owner-has-role.precondition.ts");
    expect(piece.className).toBe("OwnerHasRolePrecondition");
    expect(piece.pieceName).toBe("OwnerHasRole");
    expect(piece.contents).toContain('declare module "@sapphire/framework"');
    expect(piece.contents).toContain("OwnerHasRole: never;");
    expect(piece.contents).toContain('name: "OwnerHasRole"');
  });

  // The augmentation key and the runtime name must agree, or the precondition is unusable from a command.
  it("keeps the precondition augmentation and runtime name in step", () => {
    const piece = generatePiece({ type: "precondition", name: "NeedsRole" });

    expect(piece.contents).toContain("NeedsRole: never;");
    expect(piece.contents).toContain('name: "NeedsRole"');
    expect(piece.contents).toContain("export class NeedsRolePrecondition");
  });

  // Error handling: an empty name has nothing to build a class from and must be refused.
  it("rejects an empty name", () => {
    expect(() => generatePiece({ type: "command", name: "   ", feature: "economy" })).toThrow(/Missing name/u);
  });

  // Error handling: a name that normalises to nothing must not produce a file called ".command.ts".
  it("rejects a name made only of separators", () => {
    expect(() => generatePiece({ type: "command", name: "---", feature: "economy" })).toThrow(/Invalid name/u);
  });

  // Error handling: Discord caps slash names at 32 characters, so an over-long one fails before writing.
  it("rejects a command name Discord would refuse", () => {
    const tooLong = "a".repeat(33);

    expect(() => generatePiece({ type: "command", name: tooLong, feature: "economy" })).toThrow(/valid slash/u);
  });

  // Error handling: a bogus event name would generate code that cannot compile, so it is caught early.
  it("rejects an event name that is not an identifier", () => {
    expect(() => generatePiece({ type: "listener", name: "welcome", event: "not an event" })).toThrow(/Invalid event/u);
  });

  // Every generated file must end with a trailing newline to satisfy the repo's formatting.
  it.each(PIECE_TYPES)("ends the generated %s with a newline", (type) => {
    const piece = generatePiece({ type, name: "sample", feature: "economy" });

    expect(piece.contents.endsWith("\n")).toBe(true);
    expect(piece.contents).not.toContain("\r\n");
  });

  // Generation is pure, so asking twice for the same piece must produce byte-identical output.
  it.each(PIECE_TYPES)("is deterministic for a %s", (type) => {
    const options = { type, name: "sample", feature: "economy" } as const;

    expect(generatePiece(options).contents).toBe(generatePiece(options).contents);
  });
});

describe("parseArgs", () => {
  // Normal case: the documented invocation has to split into a name plus its value flags.
  it("separates positionals from valued flags", () => {
    const { positionals, flags } = parseArgs(["--feature", "economy", "shop"]);

    expect(positionals).toEqual(["shop"]);
    expect(flags.get("feature")).toBe("economy");
  });

  // Normal case: the --flag=value form is documented as equivalent to the spaced form.
  it("accepts the inline value form", () => {
    expect(parseArgs(["--feature=economy", "shop"]).flags.get("feature")).toBe("economy");
  });

  // Regression: a boolean flag used to consume the following token, losing the name entirely.
  it("does not let a boolean flag swallow the name that follows it", () => {
    const { positionals, flags } = parseArgs(["--feature", "economy", "--dry-run", "shop"]);

    expect(positionals).toEqual(["shop"]);
    expect(flags.get("dry-run")).toBe(true);
  });

  // Regression: every boolean flag must behave that way, not just the one that surfaced the bug.
  it.each(["dry-run", "force", "no-lint"])("treats --%s as a boolean", (flag) => {
    const { positionals, flags } = parseArgs([`--${flag}`, "shop"]);

    expect(positionals).toEqual(["shop"]);
    expect(flags.get(flag)).toBe(true);
  });

  // Edge case: flag order must not matter, so the name is found wherever it sits.
  it("finds the name regardless of flag order", () => {
    expect(parseArgs(["--force", "--feature", "economy", "shop"]).positionals).toEqual(["shop"]);
    expect(parseArgs(["shop", "--force", "--feature", "economy"]).positionals).toEqual(["shop"]);
  });

  // Edge case: a valued flag with nothing after it must not read past the end of the argument list.
  it("tolerates a trailing valued flag with no value", () => {
    const { positionals, flags } = parseArgs(["shop", "--feature"]);

    expect(positionals).toEqual(["shop"]);
    expect(flags.get("feature")).toBe(true);
  });

  // Edge case: two flags in a row must not make the second one the first one's value.
  it("does not treat a following flag as a value", () => {
    const flags = parseArgs(["--feature", "--force", "shop"]).flags;

    expect(flags.get("feature")).toBe(true);
    expect(flags.get("force")).toBe(true);
  });

  // Edge case: no arguments at all is a valid parse producing nothing, not a crash.
  it("returns empty results for no arguments", () => {
    const { positionals, flags } = parseArgs([]);

    expect(positionals).toEqual([]);
    expect(flags.size).toBe(0);
  });
});

describe("readStringFlag", () => {
  // Normal case: a flag carrying a value reads back as that string.
  it("reads a string value", () => {
    expect(readStringFlag(parseArgs(["--feature", "economy"]).flags, "feature")).toBe("economy");
  });

  // Edge case: a boolean flag is not a value, so callers must get undefined rather than `true`.
  it("returns undefined for a boolean flag", () => {
    expect(readStringFlag(parseArgs(["--force"]).flags, "force")).toBeUndefined();
  });

  // Edge case: an absent flag reads as undefined so the generator falls back to its default.
  it("returns undefined for a missing flag", () => {
    expect(readStringFlag(new Map(), "feature")).toBeUndefined();
  });
});

describe("missingNameUsage", () => {
  // The common trap: --feature swallows the last token, so the suggestion must keep their flag and add a name.
  it("echoes the flags that were passed back with a name slot", () => {
    const { flags } = parseArgs(["--feature", "uwufier"]);

    expect(missingNameUsage("listener", flags)).toBe("npm run g:listener -- --feature uwufier <name>");
  });

  // Edge case: with no flags at all the suggestion collapses to the bare form, with no stray spacing.
  it("suggests the bare form when no flags were passed", () => {
    expect(missingNameUsage("precondition", new Map())).toBe("npm run g:precondition -- <name>");
  });

  // Edge case: a boolean flag has no value, so it must be echoed on its own rather than as "--force true".
  it("echoes a boolean flag without a value", () => {
    const { flags } = parseArgs(["--force"]);

    expect(missingNameUsage("command", flags)).toBe("npm run g:command -- --force <name>");
  });

  // Every flag the caller typed has to survive into the suggestion, or the fix would drop their intent.
  it("keeps every flag in the order they were given", () => {
    const { flags } = parseArgs(["--feature", "uwufier", "--event", "GuildMemberAdd", "--force"]);

    expect(missingNameUsage("listener", flags)).toBe(
      "npm run g:listener -- --feature uwufier --event GuildMemberAdd --force <name>",
    );
  });

  // The suggestion has to name the piece type the caller actually asked for.
  it.each(PIECE_TYPES)("names the %s script", (type) => {
    expect(missingNameUsage(type, new Map())).toContain(`g:${type}`);
  });
});
