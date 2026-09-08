import { db } from "@infrastructure/database/client.js";
import { copypastaPosts } from "@infrastructure/database/schema/copypasta.schema.js";

import { gte } from "drizzle-orm";

export function findPostedCopypastaIds(since: Date): string[] {
  return db
    .select({ postId: copypastaPosts.postId })
    .from(copypastaPosts)
    .where(gte(copypastaPosts.postedAt, since))
    .all()
    .map((row) => row.postId);
}

export function recordPostedCopypasta(postId: string, postedAt: Date): void {
  db.insert(copypastaPosts)
    .values({ postId, postedAt })
    .onConflictDoUpdate({ target: copypastaPosts.postId, set: { postedAt } })
    .run();
}
