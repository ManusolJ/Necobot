ALTER TABLE `guild_users` ADD `last_begged_at` integer;--> statement-breakpoint
ALTER TABLE `guild_users` DROP COLUMN `last_active_at`;--> statement-breakpoint
ALTER TABLE `guild_settings` ADD `beg_retry_role_id` text;