import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const copypastaPosts = pgTable("copypasta_posts", {
  postId: text("post_id").primaryKey(),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
});
