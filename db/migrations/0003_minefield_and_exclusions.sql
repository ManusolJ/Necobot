ALTER TABLE `guild_users` ADD `excluded_at` integer;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `active_mines` integer DEFAULT 0 NOT NULL;