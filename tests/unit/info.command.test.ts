import { EMBED_COLOR, BOT_DISPLAY_NAME } from "@shared/consts/branding.constants.js";

import { MINE_COST } from "@features/minefield/minefield.constants.js";
import { SPEAK_POINTS_COST } from "@features/voice/voice.constants.js";
import { PUNISH_PERCENT } from "@features/moderation/moderation.constants.js";
import { buildInfoEmbed } from "@features/information/commands/info.command.js";
import { INFO_EMBED_TITLE, INFO_COMMAND_GROUPS } from "@features/information/information.constants.js";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const featuresRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "features");

const CATALOGUED = INFO_COMMAND_GROUPS.flatMap((group) => group.commands);
const CATALOGUED_NAMES = CATALOGUED.map((command) => command.name);

function commandFilePaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return commandFilePaths(path);
    }

    return entry.name.endsWith(".command.ts") ? [path] : [];
  });
}

/**
 * Pulls the slash command name out of the `registerApplicationCommands` builder chain. Only the name
 * applied directly to `builder` counts, so option and subcommand names are ignored.
 */
function registeredName(source: string): string | undefined {
  return /builder\s*\.setName\("([^"]+)"\)/u.exec(source)?.[1];
}

const REGISTERED_NAMES = commandFilePaths(featuresRoot)
  .map((path) => registeredName(readFileSync(path, "utf8")))
  .filter((name): name is string => name !== undefined)
  .sort();

describe("command catalogue coverage", () => {
  // Guards against drift: a newly added command that nobody listed here would silently miss from /info.
  it("lists every command the bot registers", () => {
    expect([...CATALOGUED_NAMES].sort()).toEqual(REGISTERED_NAMES);
  });

  // Guards the other direction: a renamed or deleted command must not linger in the embed as a dead entry.
  it("lists no command that does not exist", () => {
    for (const name of CATALOGUED_NAMES) {
      expect(REGISTERED_NAMES).toContain(name);
    }
  });

  // Sanity check on the scanner itself, so an empty match set can never make the coverage tests pass vacuously.
  it("found a realistic number of registered commands", () => {
    expect(REGISTERED_NAMES.length).toBeGreaterThan(10);
  });

  // Edge case: the same command placed in two groups would render twice in the embed.
  it("does not repeat a command across groups", () => {
    expect(new Set(CATALOGUED_NAMES).size).toBe(CATALOGUED_NAMES.length);
  });

  // The command is meant to be self-describing, so the listing has to include itself.
  it("includes the info command itself", () => {
    expect(CATALOGUED_NAMES).toContain("info");
  });
});

describe("command catalogue content", () => {
  // Normal case: an entry with no description would render as a bare name and explain nothing.
  it("gives every command a non-empty description", () => {
    for (const command of CATALOGUED) {
      expect(command.description.trim().length).toBeGreaterThan(0);
    }
  });

  // The embed is an at-a-glance overview, so descriptions must stay short enough to scan in one line.
  it("keeps every description brief", () => {
    for (const command of CATALOGUED) {
      expect(command.description.length).toBeLessThanOrEqual(80);
    }
  });

  // Edge case: an empty group would render as a field with no value, which Discord rejects outright.
  it("gives every group a name and at least one command", () => {
    for (const group of INFO_COMMAND_GROUPS) {
      expect(group.name.trim().length).toBeGreaterThan(0);
      expect(group.commands.length).toBeGreaterThan(0);
    }
  });

  // Two groups sharing a heading would read as a duplicated section in the embed.
  it("does not repeat a group name", () => {
    const names = INFO_COMMAND_GROUPS.map((group) => group.name);

    expect(new Set(names).size).toBe(names.length);
  });

  // Costs are interpolated from the owning feature's constants so a price change cannot leave the help text stale.
  it("quotes the live point costs", () => {
    const byName = new Map(CATALOGUED.map((command) => [command.name, command.description]));

    expect(byName.get("minefield")).toContain(String(MINE_COST));
    expect(byName.get("speak")).toContain(String(SPEAK_POINTS_COST));
    expect(byName.get("punish")).toContain(String(PUNISH_PERCENT * 100));
  });
});

describe("buildInfoEmbed", () => {
  // Normal case: each category becomes one embed field, in the order the catalogue declares.
  it("renders one field per group in order", () => {
    const fields = buildInfoEmbed().data.fields ?? [];

    expect(fields.map((field) => field.name)).toEqual(INFO_COMMAND_GROUPS.map((group) => group.name));
  });

  // Normal case: every command shows as a slash-prefixed name followed by its description.
  it("renders each command as a slash name with its description", () => {
    const fields = buildInfoEmbed().data.fields ?? [];

    for (const [index, group] of INFO_COMMAND_GROUPS.entries()) {
      for (const command of group.commands) {
        expect(fields[index]?.value).toContain(`\`/${command.name}\` - ${command.description}`);
      }
    }
  });

  // Normal case: every catalogued command has to survive into the rendered output, not just into the constants.
  it("mentions every catalogued command somewhere in the embed", () => {
    const rendered = (buildInfoEmbed().data.fields ?? []).map((field) => field.value).join("\n");

    for (const name of CATALOGUED_NAMES) {
      expect(rendered).toContain(`\`/${name}\``);
    }
  });

  // Normal case: branding has to match the other embeds the bot sends.
  it("applies the shared branding", () => {
    const embed = buildInfoEmbed().data;

    expect(embed.title).toBe(INFO_EMBED_TITLE);
    expect(embed.color).toBe(EMBED_COLOR);
    expect(embed.footer?.text).toBe(BOT_DISPLAY_NAME);
    expect(embed.timestamp).toBeDefined();
  });

  // Normal case: the caller passes the bot avatar, which should appear as the embed thumbnail.
  it("uses the supplied icon as the thumbnail", () => {
    const embed = buildInfoEmbed("https://cdn.example/avatar.png").data;

    expect(embed.thumbnail?.url).toBe("https://cdn.example/avatar.png");
  });

  // Edge case: with no icon available the embed must simply omit the thumbnail rather than set an empty URL.
  it("omits the thumbnail when no icon is given", () => {
    expect(buildInfoEmbed().data.thumbnail).toBeUndefined();
  });

  // Edge case: Discord rejects an embed with more than 25 fields, so the grouping must stay under that cap.
  it("stays within the field count limit", () => {
    expect((buildInfoEmbed().data.fields ?? []).length).toBeLessThanOrEqual(25);
  });

  // Edge case: a group that outgrows 1024 characters would make Discord reject the whole reply.
  it("stays within the per-field length limit", () => {
    for (const field of buildInfoEmbed().data.fields ?? []) {
      expect(field.name.length).toBeLessThanOrEqual(256);
      expect(field.value.length).toBeLessThanOrEqual(1024);
    }
  });

  // Edge case: the 6000 character total is the ceiling the catalogue has to grow within as commands are added.
  it("stays within the total embed length limit", () => {
    const embed = buildInfoEmbed().data;
    const fieldLength = (embed.fields ?? []).reduce((sum, f) => sum + f.name.length + f.value.length, 0);
    const total = (embed.title?.length ?? 0) + (embed.description?.length ?? 0) + fieldLength;

    expect(total).toBeLessThanOrEqual(6000);
  });

  // Normal case: a fresh builder each call keeps one reply from mutating the embed another reply is using.
  it("returns a new embed on every call", () => {
    expect(buildInfoEmbed()).not.toBe(buildInfoEmbed());
  });
});
