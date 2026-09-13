import { CopypastaFetchError, CopypastaDeliveryError } from "@infrastructure/errors/domain.errors.js";

import { COPYPASTA_SUBREDDIT, COPYPASTA_CHANNEL_PURPOSE } from "@features/copypasta/copypasta.constants.js";

import { container } from "@sapphire/framework";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchTopPosts = vi.hoisted(() => vi.fn());
const pickCopypasta = vi.hoisted(() => vi.fn());
const formatCopypasta = vi.hoisted(() => vi.fn());
const getChannelsByPurpose = vi.hoisted(() => vi.fn());
const markCopypastaPosted = vi.hoisted(() => vi.fn());

vi.mock("@infrastructure/reddit/reddit.client.js", () => ({ fetchTopPosts }));

vi.mock("@core/services/guild.service.js", () => ({ getChannelsByPurpose }));

vi.mock("@core/services/copypasta-history.service.js", () => ({ markCopypastaPosted }));

vi.mock("@features/copypasta/copypasta.service.js", () => ({ pickCopypasta, formatCopypasta }));

const { DailyPastaTask } = await import("@features/copypasta/scheduled-tasks/daily-pasta.task.js");

const POST = { id: "a1", title: "Un titulo", selftext: "cuerpo" };
const CONTENT = "**Un titulo**\n\ncuerpo";

let send: ReturnType<typeof vi.fn>;
let fetchChannel: ReturnType<typeof vi.fn>;

function task(): InstanceType<typeof DailyPastaTask> {
  return new DailyPastaTask(
    {
      store: { name: "scheduled-tasks" },
      path: "daily-pasta.task.ts",
      name: "dailyPasta",
      root: process.cwd(),
    } as never,
    {},
  );
}

function channels(...guildIds: string[]): { guildId: string; channelId: string; purpose: string }[] {
  return guildIds.map((guildId) => ({
    guildId,
    channelId: `channel-${guildId}`,
    purpose: COPYPASTA_CHANNEL_PURPOSE,
  }));
}

beforeEach(() => {
  send = vi.fn().mockResolvedValue(undefined);
  fetchChannel = vi.fn().mockResolvedValue({ isSendable: () => true, send });

  container.client = { channels: { fetch: fetchChannel } } as never;

  getChannelsByPurpose.mockReset().mockReturnValue(channels("guild-1"));
  fetchTopPosts.mockReset().mockResolvedValue([POST]);
  pickCopypasta.mockReset().mockReturnValue(POST);
  formatCopypasta.mockReset().mockReturnValue(CONTENT);
  markCopypastaPosted.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DailyPastaTask", () => {
  // Normal case: the configured channel receives the formatted pasta.
  it("sends the pasta to a configured channel", async () => {
    await task().run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ content: CONTENT });
  });

  // Reddit text is untrusted, so an @everyone in a copypasta must never ping the guild.
  it("suppresses mentions in the sent message", async () => {
    await task().run();

    expect(send.mock.calls[0]?.[0]).toMatchObject({ allowedMentions: { parse: [] } });
  });

  // Edge case: with nothing configured there is no reason to spend a Reddit call.
  it("does not call Reddit when no guild has a copypasta channel", async () => {
    getChannelsByPurpose.mockReturnValue([]);

    await task().run();

    expect(fetchTopPosts).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  // Error handling: a failed fetch has to surface as a throw so BullMQ retries the job.
  it("throws when the listing cannot be fetched", async () => {
    fetchTopPosts.mockResolvedValue(undefined);

    await expect(task().run()).rejects.toBeInstanceOf(CopypastaFetchError);
  });

  // Edge case: nothing eligible is a quiet skip, not a job failure that would retry pointlessly.
  it("returns without sending when no post is eligible", async () => {
    pickCopypasta.mockReturnValue(undefined);

    await task().run();

    expect(send).not.toHaveBeenCalled();
  });

  // Every guild gets the same daily pasta, so the pick must not run once per guild.
  it("picks a single pasta for every guild", async () => {
    getChannelsByPurpose.mockReturnValue(channels("guild-1", "guild-2", "guild-3"));

    await task().run();

    expect(pickCopypasta).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(3);
  });

  // Edge case: a deleted or invisible channel skips that guild without touching the others.
  it("skips a guild whose channel cannot be fetched", async () => {
    getChannelsByPurpose.mockReturnValue(channels("guild-1", "guild-2"));
    fetchChannel.mockRejectedValueOnce(new Error("Unknown Channel"));

    await task().run();

    expect(send).toHaveBeenCalledTimes(1);
  });

  // Edge case: a voice or forum channel is not sendable and must not abort the run.
  it("skips a guild whose channel is not sendable", async () => {
    getChannelsByPurpose.mockReturnValue(channels("guild-1", "guild-2"));
    fetchChannel.mockResolvedValueOnce({ isSendable: () => false });

    await task().run();

    expect(send).toHaveBeenCalledTimes(1);
  });

  // This is the regression that made a retry re-post to guilds that had already been served.
  it("keeps going when one guild's send fails", async () => {
    getChannelsByPurpose.mockReturnValue(channels("guild-1", "guild-2", "guild-3"));
    send.mockRejectedValueOnce(new Error("Missing Permissions"));

    await task().run();

    expect(send).toHaveBeenCalledTimes(3);
  });

  // A partial failure is logged and swallowed: failing the job would retry and repost to the
  // guilds that were already served.
  it("does not fail the job when some sends fail", async () => {
    getChannelsByPurpose.mockReturnValue(channels("guild-1", "guild-2"));
    send.mockRejectedValueOnce(new Error("Missing Permissions"));

    await expect(task().run()).resolves.toBeUndefined();
    expect(markCopypastaPosted).toHaveBeenCalledWith("a1");
  });

  // Nothing delivered means nobody saw the post: it must not be burned, and the job fails so the
  // retry policy gets another go.
  it("fails the job and records nothing when no guild could be sent to", async () => {
    send.mockRejectedValue(new Error("Missing Permissions"));

    await expect(task().run()).rejects.toBeInstanceOf(CopypastaDeliveryError);
    expect(markCopypastaPosted).not.toHaveBeenCalled();
  });

  it("records the post once it has been delivered", async () => {
    await task().run();

    expect(markCopypastaPosted).toHaveBeenCalledWith("a1");
  });

  it("records nothing when no post is eligible", async () => {
    pickCopypasta.mockReturnValue(undefined);

    await task().run();

    expect(markCopypastaPosted).not.toHaveBeenCalled();
  });

  // The task reads the channels registered under the copypasta purpose, not some other list.
  it("looks up channels by the copypasta purpose", async () => {
    await task().run();

    expect(getChannelsByPurpose).toHaveBeenCalledWith(COPYPASTA_CHANNEL_PURPOSE);
  });

  // The subreddit the feature is named after is the one it must read.
  it("fetches from the copypasta subreddit", async () => {
    await task().run();

    expect(fetchTopPosts.mock.calls[0]?.[0]).toBe(COPYPASTA_SUBREDDIT);
  });
});
