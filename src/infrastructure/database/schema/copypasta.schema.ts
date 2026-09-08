import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const copypastaPosts = sqliteTable("copypasta_posts", {
  postId: text("post_id").primaryKey(),
  postedAt: integer("posted_at", { mode: "timestamp" }).notNull(),
});
