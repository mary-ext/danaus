CREATE TABLE `repo_seq` (
	`seq` integer PRIMARY KEY AUTOINCREMENT,
	`did` text NOT NULL,
	`event_type` text NOT NULL,
	`event` text NOT NULL,
	`blocks` blob,
	`invalidated` integer DEFAULT 0 NOT NULL,
	`sequenced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `repo_seq_did_idx` ON `repo_seq` (`did`);--> statement-breakpoint
CREATE INDEX `repo_seq_event_type_idx` ON `repo_seq` (`event_type`);--> statement-breakpoint
CREATE INDEX `repo_seq_sequenced_at_idx` ON `repo_seq` (`sequenced_at`);