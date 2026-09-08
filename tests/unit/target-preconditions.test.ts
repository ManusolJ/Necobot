import { NotSelfPrecondition } from "@shared/preconditions/not-self.precondition.js";
import { NotABotPrecondition } from "@shared/preconditions/not-abot.precondition.js";

import type { ChatInputCommandInteraction, CommandInteractionOption } from "discord.js";

import { describe, expect, it } from "vitest";

const CALLER = "caller-1";
const OTHER = "other-1";

function build<T>(Ctor: new (context: never, options: never) => T, name: string): T {
  const context = { store: { name: "preconditions" }, path: `${name}.ts`, name, root: process.cwd() };
  return new Ctor(context as never, {} as never);
}

/** A resolved user option, the shape discord.js puts in `interaction.options.data`. */
function userOption(id: string, bot = false): CommandInteractionOption {
  return { name: "user", type: 6, user: { id, bot } } as unknown as CommandInteractionOption;
}

/** A subcommand option, which nests its own options one level down. */
function subcommand(...options: CommandInteractionOption[]): CommandInteractionOption {
  return { name: "sub", type: 1, options };
}

function stubInteraction(options: CommandInteractionOption[], inGuild = true): ChatInputCommandInteraction {
  return {
    user: { id: CALLER },
    inGuild: () => inGuild,
    options: { data: options },
  } as unknown as ChatInputCommandInteraction;
}

const notABot = build(NotABotPrecondition, "NotABot");
const notSelf = build(NotSelfPrecondition, "NotSelf");

describe("NotABot", () => {
  // Normal case: slapping a real person is the whole point, so a human target must pass.
  it("allows a human target", async () => {
    const result = await notABot.chatInputRun(stubInteraction([userOption(OTHER)]));

    expect(result.isOk()).toBe(true);
  });

  // Normal case: a bot cannot be on the receiving end of these commands.
  it("rejects a bot target", async () => {
    const result = await notABot.chatInputRun(stubInteraction([userOption(OTHER, true)]));

    expect(result.isErr()).toBe(true);
  });

  // Edge case: the precondition is reusable, so a command with no user option must pass untouched.
  it("allows a command with no user option", async () => {
    const result = await notABot.chatInputRun(stubInteraction([]));

    expect(result.isOk()).toBe(true);
  });

  // Edge case: only one option needs to be a bot for the whole interaction to be rejected.
  it("rejects when only one of several targets is a bot", async () => {
    const result = await notABot.chatInputRun(stubInteraction([userOption(OTHER), userOption("bot-1", true)]));

    expect(result.isErr()).toBe(true);
  });

  // Edge case: subcommands nest their options, so the walk has to recurse to find the target.
  it("finds a bot nested inside a subcommand", async () => {
    const result = await notABot.chatInputRun(stubInteraction([subcommand(userOption("bot-1", true))]));

    expect(result.isErr()).toBe(true);
  });

  // Edge case: a nested human target must still pass, proving the recursion is not blanket-rejecting.
  it("allows a human nested inside a subcommand", async () => {
    const result = await notABot.chatInputRun(stubInteraction([subcommand(userOption(OTHER))]));

    expect(result.isOk()).toBe(true);
  });

  // Edge case: these are guild commands, so outside a guild the check has nothing to say.
  it("allows anything outside a guild", async () => {
    const result = await notABot.chatInputRun(stubInteraction([userOption(OTHER, true)], false));

    expect(result.isOk()).toBe(true);
  });

  // The rejection has to carry the code and user-facing copy the error listener reports.
  it("reports the target_is_bot code and message", async () => {
    const result = await notABot.chatInputRun(stubInteraction([userOption(OTHER, true)]));
    const error = result.unwrapErr();

    expect(error.context).toEqual({ code: "target_is_bot" });
    expect(error.message).toContain("bots");
  });
});

describe("NotSelf", () => {
  // Normal case: targeting somebody else is ordinary use and must pass.
  it("allows targeting another user", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([userOption(OTHER)]));

    expect(result.isOk()).toBe(true);
  });

  // Normal case: the caller must not be able to name themselves as the target.
  it("rejects targeting yourself", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([userOption(CALLER)]));

    expect(result.isErr()).toBe(true);
  });

  // Edge case: a command with no user option has no self-target to find.
  it("allows a command with no user option", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([]));

    expect(result.isOk()).toBe(true);
  });

  // Edge case: naming yourself among several targets is still self-targeting.
  it("rejects when the caller is one of several targets", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([userOption(OTHER), userOption(CALLER)]));

    expect(result.isErr()).toBe(true);
  });

  // Edge case: the recursion has to reach targets nested under a subcommand.
  it("finds the caller nested inside a subcommand", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([subcommand(userOption(CALLER))]));

    expect(result.isErr()).toBe(true);
  });

  // Edge case: matching is by id, so a different user is never mistaken for the caller.
  it("does not confuse another user with the caller", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([subcommand(userOption(OTHER))]));

    expect(result.isOk()).toBe(true);
  });

  // Edge case: outside a guild there is nothing to enforce.
  it("allows anything outside a guild", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([userOption(CALLER)], false));

    expect(result.isOk()).toBe(true);
  });

  // The rejection has to carry the code and user-facing copy the error listener reports.
  it("reports the target_is_self code and message", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([userOption(CALLER)]));
    const error = result.unwrapErr();

    expect(error.context).toEqual({ code: "target_is_self" });
    expect(error.message.length).toBeGreaterThan(0);
  });

  // The two guards are independent: a bot that is not you is NotSelf's business to allow.
  it("leaves bot targets to NotABot", async () => {
    const result = await notSelf.chatInputRun(stubInteraction([userOption(OTHER, true)]));

    expect(result.isOk()).toBe(true);
  });
});
