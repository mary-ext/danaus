CREATE TABLE `did_doc` (
	`did` text PRIMARY KEY,
	`doc` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `handle` (
	`handle` text PRIMARY KEY,
	`did` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `did_doc_updated_at_idx` ON `did_doc` (`updated_at`);--> statement-breakpoint
CREATE INDEX `handle_updated_at_idx` ON `handle` (`updated_at`);