CREATE TABLE `guild_channels` (
	`guild_id` text NOT NULL,
	`purpose` text NOT NULL,
	`channel_id` text NOT NULL,
	PRIMARY KEY(`guild_id`, `purpose`),
	FOREIGN KEY (`guild_id`) REFERENCES `guild_settings`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guild_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`prefix` text DEFAULT '!' NOT NULL,
	`main_channel_id` text,
	`setup_completed_at` integer
);
