import type { PieceType } from "@shared/types/piece.type.js";
import type { ParsedArgs } from "@shared/types/parsed-args.type.js";
import type { GeneratedPiece } from "@shared/types/generated-piece.type.js";
import type { GenerateOptions } from "@shared/types/generation-options.type.js";

export const PIECE_TYPES: readonly PieceType[] = ["command", "listener", "precondition"];

export const DEFAULT_EVENT = "MessageCreate";

const BOOLEAN_FLAGS = new Set(["dry-run", "force", "no-lint"]);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey ?? "";

    if (inlineValue !== undefined) {
      flags.set(key, inlineValue);
      continue;
    }

    if (BOOLEAN_FLAGS.has(key)) {
      flags.set(key, true);
      continue;
    }

    const next = argv[index + 1];

    if (next !== undefined && !next.startsWith("--")) {
      flags.set(key, next);
      index += 1;
      continue;
    }

    flags.set(key, true);
  }

  return { positionals, flags };
}

export function readStringFlag(flags: Map<string, string | true>, key: string): string | undefined {
  const value = flags.get(key);
  return typeof value === "string" ? value : undefined;
}

export function missingNameUsage(type: PieceType, flags: Map<string, string | true>): string {
  const passed = [...flags.entries()]
    .map(([key, value]) => (value === true ? `--${key}` : `--${key} ${value}`))
    .join(" ");

  return `npm run g:${type} -- ${passed === "" ? "" : `${passed} `}<name>`;
}

const SUFFIXES: Record<PieceType, string> = {
  command: "Command",
  listener: "Listener",
  precondition: "Precondition",
};

const FOLDERS: Record<PieceType, string> = {
  command: "commands",
  listener: "listeners",
  precondition: "preconditions",
};

const SLASH_NAME_PATTERN = /^[-_\p{Ll}\p{N}]{1,32}$/u;
const SAFE_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

type EventSignature = { params: string; typeImports: readonly string[]; logFields: string };

const EVENT_SIGNATURES: Record<string, EventSignature> = {
  ClientReady: { params: "", typeImports: [], logFields: "" },
  MessageCreate: {
    params: "message: Message",
    typeImports: ["Message"],
    logFields: ", messageId: message.id",
  },
  MessageUpdate: {
    params: "_oldMessage: Message, newMessage: Message",
    typeImports: ["Message"],
    logFields: ", messageId: newMessage.id",
  },
  GuildMemberAdd: {
    params: "member: GuildMember",
    typeImports: ["GuildMember"],
    logFields: ", userId: member.id",
  },
  InteractionCreate: {
    params: "interaction: Interaction",
    typeImports: ["Interaction"],
    logFields: ", interactionId: interaction.id",
  },
  VoiceStateUpdate: {
    params: "_oldState: VoiceState, newState: VoiceState",
    typeImports: ["VoiceState"],
    logFields: ", guildId: newState.guild.id",
  },
};

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/[\s_]+/gu, "-")
    .toLowerCase()
    .replace(/-{2,}/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function toPascalCase(value: string): string {
  return toKebabCase(value)
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function stripSuffix(pascal: string, suffix: string): string {
  return pascal.length > suffix.length && pascal.endsWith(suffix) ? pascal.slice(0, -suffix.length) : pascal;
}

function assertSafeSegment(value: string, label: string): void {
  if (!SAFE_SEGMENT_PATTERN.test(value)) {
    throw new Error(`Invalid ${label} "${value}". Use lowercase words separated by single hyphens.`);
  }
}

function commandTemplate(className: string, slashName: string): string {
  return `import { requireGuildMember } from "@shared/utils/guild-context.util.js";

import type { ChatInputCommandInteraction } from "discord.js";
import type { ApplicationCommandRegistry, Awaitable } from "@sapphire/framework";

import { MessageFlags } from "discord.js";
import { Command } from "@sapphire/framework";

export class ${className} extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      preconditions: ["GuildConfigured", "NotExcluded"],
    });
  }

  public override registerApplicationCommands(registry: ApplicationCommandRegistry): Awaitable<void> {
    registry.registerChatInputCommand((builder) =>
      builder.setName("${slashName}").setDescription("TODO: describe what /${slashName} does"),
    );
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const { guildId, member } = requireGuildMember(interaction);

    // TODO: implement /${slashName}
    await interaction.reply({
      content: \`TODO: /${slashName} para \${member.displayName} en \${guildId}\`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
`;
}

function listenerTemplate(className: string, event: string): string {
  const signature = EVENT_SIGNATURES[event] ?? {
    params: `..._args: ClientEvents[typeof Events.${event}]`,
    typeImports: ["ClientEvents"],
    logFields: "",
  };

  const typeImport =
    signature.typeImports.length > 0
      ? `import type { ${[...signature.typeImports].join(", ")} } from "discord.js";\n\n`
      : "";

  return `import { logger } from "@infrastructure/config/logger.config.js";

${typeImport}import { Events, Listener } from "@sapphire/framework";

export class ${className} extends Listener<typeof Events.${event}> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.${event} });
  }

  public override run(${signature.params}): void {
    // TODO: implement the ${className}
    logger.debug({ event: Events.${event}${signature.logFields} }, "${className} fired");
  }
}
`;
}

function preconditionTemplate(className: string, preconditionName: string): string {
  return `import type { ChatInputCommandInteraction } from "discord.js";

import { Precondition } from "@sapphire/framework";

declare module "@sapphire/framework" {
  interface Preconditions {
    ${preconditionName}: never;
  }
}

export class ${className} extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, { ...options, name: "${preconditionName}" });
  }

  public override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      return this.ok();
    }

    // TODO: implement the ${preconditionName} check
    return this.ok();
  }
}
`;
}

export function resolveTargetPath(type: PieceType, fileName: string, feature?: string): string {
  const folder = FOLDERS[type];

  if (feature !== undefined) {
    assertSafeSegment(feature, "feature name");
    return `src/features/${feature}/${folder}/${fileName}.${type}.ts`;
  }

  if (type === "command") {
    throw new Error("Commands must live in a feature. Pass --feature <name>.");
  }

  return `src/shared/${folder}/${fileName}.${type}.ts`;
}

export function generatePiece(options: GenerateOptions): GeneratedPiece {
  const { name, type, feature, event = DEFAULT_EVENT } = options;

  if (name.trim().length === 0) {
    throw new Error(`Missing name. Usage: npm run g:${type} -- <name>`);
  }

  const suffix = SUFFIXES[type];
  const base = stripSuffix(toPascalCase(name), suffix);

  if (base.length === 0) {
    throw new Error(`Invalid name "${name}".`);
  }

  const fileName = toKebabCase(base);
  const className = `${base}${suffix}`;

  assertSafeSegment(fileName, `${type} name`);

  if (type === "command" && !SLASH_NAME_PATTERN.test(fileName)) {
    throw new Error(`"${fileName}" is not a valid slash command name (lowercase, 1-32 chars).`);
  }

  if (type === "listener" && !/^[A-Za-z][A-Za-z0-9]*$/u.test(event)) {
    throw new Error(`Invalid event "${event}". Use a Sapphire event name such as ${DEFAULT_EVENT}.`);
  }

  const pieceName = type === "precondition" ? base : fileName;

  const contents =
    type === "command"
      ? commandTemplate(className, fileName)
      : type === "listener"
        ? listenerTemplate(className, event)
        : preconditionTemplate(className, base);

  const resolvedFeature = feature ?? (type === "command" ? fileName : undefined);

  return {
    path: resolveTargetPath(type, fileName, resolvedFeature),
    contents,
    className,
    pieceName,
  };
}
