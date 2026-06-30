CREATE TABLE `guild_users` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`trivia_wins` integer DEFAULT 0 NOT NULL,
	`times_begged` integer DEFAULT 0 NOT NULL,
	`activated_mines` integer DEFAULT 0 NOT NULL,
	`historical_points` integer DEFAULT 0 NOT NULL,
	`last_active_at` integer,
	PRIMARY KEY(`guild_id`, `user_id`),
	FOREIGN KEY (`guild_id`) REFERENCES `guild_settings`(`guild_id`) ON UPDATE no action ON DELETE cascade
);
