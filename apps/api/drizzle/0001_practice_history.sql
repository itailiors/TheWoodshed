CREATE TABLE `coach_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`tune_id` text,
	`move_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`key_tonic` text NOT NULL,
	`clean` integer NOT NULL,
	`misses` integer NOT NULL,
	`leaps` integer NOT NULL,
	`max_leap` integer NOT NULL,
	`grade` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tune_id`) REFERENCES `tunes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `coach_attempts_concept_idx` ON `coach_attempts` (`rule_id`,`key_tonic`);--> statement-breakpoint
CREATE INDEX `coach_attempts_session_idx` ON `coach_attempts` (`session_id`);--> statement-breakpoint
CREATE TABLE `concept_reviews` (
	`rule_id` text NOT NULL,
	`key_tonic` text NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`ease` real DEFAULT 2.5 NOT NULL,
	`interval_days` real DEFAULT 0 NOT NULL,
	`due_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`clean_runs` integer DEFAULT 0 NOT NULL,
	`last_grade` integer,
	`last_reviewed_at` integer,
	PRIMARY KEY(`rule_id`, `key_tonic`)
);
--> statement-breakpoint
CREATE INDEX `concept_reviews_due_idx` ON `concept_reviews` (`due_at`);--> statement-breakpoint
CREATE TABLE `improv_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`tune_id` text,
	`level` integer NOT NULL,
	`view` text NOT NULL,
	`loop_start_bar` integer NOT NULL,
	`loop_end_bar` integer NOT NULL,
	`notes` integer NOT NULL,
	`chord_tone_pct` integer NOT NULL,
	`tension_pct` integer NOT NULL,
	`avoid_pct` integer NOT NULL,
	`outside_pct` integer NOT NULL,
	`strong_beat_chord_tone_pct` integer,
	`guide_tone_landings` integer NOT NULL,
	`held_avoid_notes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tune_id`) REFERENCES `tunes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `improv_runs_tune_idx` ON `improv_runs` (`tune_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tune_id` text,
	`mode` text NOT NULL,
	`tempo` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`tune_id`) REFERENCES `tunes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `practice_sessions_started_idx` ON `practice_sessions` (`started_at`);