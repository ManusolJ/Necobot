import { BOOK_NOT_FOUND, BOOK_UNAVAILABLE } from "@features/book-info/book-info.messages.js";

import type { ChatInputCommandInteraction } from "discord.js";

import { EmbedBuilder } from "discord.js";
import { container } from "@sapphire/framework";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findBook = vi.hoisted(() => vi.fn());
const buildBookEmbed = vi.hoisted(() => vi.fn());

vi.mock("@features/book-info/book-info.service.js", () => ({ findBook, buildBookEmbed }));

container.client = { options: {} } as never;

const { BookInfoCommand } = await import("@features/book-info/commands/book-info.command.js");

const command = new BookInfoCommand(
  { store: { name: "commands" }, path: "book-info.command.ts", name: "book-info", root: process.cwd() } as never,
  {},
);

const EMBED = new EmbedBuilder().setTitle("Rayuela");

let deferReply: ReturnType<typeof vi.fn>;
let editReply: ReturnType<typeof vi.fn>;

function stubInteraction(options: {
  title: string;
  author?: string | null;
  locale?: string;
}): ChatInputCommandInteraction {
  return {
    locale: options.locale ?? "es-ES",
    options: {
      getString: (name: string) => (name === "titulo" ? options.title : (options.author ?? null)),
    },
    deferReply,
    editReply,
  } as unknown as ChatInputCommandInteraction;
}

beforeEach(() => {
  findBook.mockReset().mockResolvedValue({ status: "found", book: { title: "Rayuela" } });
  buildBookEmbed.mockReset().mockReturnValue(EMBED);
  deferReply = vi.fn().mockResolvedValue(undefined);
  editReply = vi.fn().mockResolvedValue(undefined);
});

describe("BookInfoCommand", () => {
  // Two external APIs plus retries can exceed Discord's three-second window, so the reply is deferred first.
  it("defers before looking the book up", async () => {
    findBook.mockImplementation(() => {
      expect(deferReply).toHaveBeenCalled();
      return Promise.resolve({ status: "not_found" });
    });

    await command.chatInputRun(stubInteraction({ title: "Rayuela" }));

    expect(findBook).toHaveBeenCalled();
  });

  // The asking user's Discord language drives the synopsis language, reduced to the bare language code.
  it("looks the book up in the user's Discord language", async () => {
    await command.chatInputRun(stubInteraction({ title: " Rayuela ", author: " Cortázar ", locale: "es-419" }));

    expect(findBook).toHaveBeenCalledWith({ title: "Rayuela", author: "Cortázar", language: "es" });
    expect(buildBookEmbed).toHaveBeenCalledWith({ title: "Rayuela" }, "es");
  });

  it("treats a blank author as no author", async () => {
    await command.chatInputRun(stubInteraction({ title: "Rayuela", author: "   ", locale: "fr" }));

    expect(findBook).toHaveBeenCalledWith({ title: "Rayuela", author: undefined, language: "fr" });
  });

  it("replies with the book embed", async () => {
    await command.chatInputRun(stubInteraction({ title: "Rayuela" }));

    expect(editReply).toHaveBeenCalledWith({ embeds: [EMBED] });
  });

  it("says so when the book does not exist", async () => {
    findBook.mockResolvedValue({ status: "not_found" });

    await command.chatInputRun(stubInteraction({ title: "asdkjhqwe" }));

    expect(editReply).toHaveBeenCalledWith(BOOK_NOT_FOUND);
  });

  it("says so when the book services are down", async () => {
    findBook.mockResolvedValue({ status: "unavailable" });

    await command.chatInputRun(stubInteraction({ title: "Rayuela" }));

    expect(editReply).toHaveBeenCalledWith(BOOK_UNAVAILABLE);
  });
});
