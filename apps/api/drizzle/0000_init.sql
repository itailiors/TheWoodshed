CREATE TABLE `setlist_tunes` (
	`setlist_id` integer NOT NULL,
	`tune_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`setlist_id`, `tune_id`),
	FOREIGN KEY (`setlist_id`) REFERENCES `setlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tune_id`) REFERENCES `tunes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `setlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `setlists_name_unique` ON `setlists` (`name`);--> statement-breakpoint
CREATE TABLE `tunes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`composer` text,
	`key_tonic` text NOT NULL,
	`key_mode` text NOT NULL,
	`meter` text NOT NULL,
	`feel` text NOT NULL,
	`tempo` integer NOT NULL,
	`bars` integer NOT NULL,
	`style` text,
	`source` text NOT NULL,
	`data` text NOT NULL,
	`import_warnings` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tunes_title_idx` ON `tunes` (`title`);