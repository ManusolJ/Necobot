import { db } from "@infrastructure/database/client.js";
import { copypastaPosts } from "@infrastructure/database/schema/copypasta.schema.js";

import type { DbExecutor } from "@shared/types/db-executor.type.js";

import { gte } from "drizzle-orm";

export async function findPostedCopypastaIds(since: Date, executor: DbExecutor = db): Promise<string[]> {
  const rows = await executor
    .select({ postId: copypastaPosts.postId })
    .from(copypastaPosts)
    .where(gte(copypastaPosts.postedAt, since));

  return rows.map((row) => row.postId);
}

export async function recordPostedCopypasta(postId: string, postedAt: Date, executor: DbExecutor = db): Promise<void> {
  await executor
    .insert(copypastaPosts)
    .values({ postId, postedAt })
    .onConflictDoUpdate({ target: copypastaPosts.postId, set: { postedAt } });
}
