CREATE TABLE `game_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`kind` text NOT NULL,
	`challenger_id` text NOT NULL,
	`challenged_id` text,
	`challenger_stake` integer DEFAULT 0 NOT NULL,
	`challenged_stake` integer DEFAULT 0 NOT NULL,
	`channel_id` text,
	`message_id` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_settings`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
