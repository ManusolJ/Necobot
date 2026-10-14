import { findPostedCopypastaIds, recordPostedCopypasta } from "@core/repositories/copypasta.repository.js";

export async function getPostedCopypastaIds(since: Date): Promise<string[]> {
  return findPostedCopypastaIds(since);
}

export async function markCopypastaPosted(postId: string): Promise<void> {
  await recordPostedCopypasta(postId, new Date());
}
