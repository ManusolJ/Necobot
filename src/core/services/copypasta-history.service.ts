import { findPostedCopypastaIds, recordPostedCopypasta } from "@core/repositories/copypasta.repository.js";

export function getPostedCopypastaIds(since: Date): string[] {
  return findPostedCopypastaIds(since);
}

export function markCopypastaPosted(postId: string): void {
  recordPostedCopypasta(postId, new Date());
}
