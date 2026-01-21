CREATE TABLE `authority` (
	`domain` text PRIMARY KEY,
	`did` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schema` (
	`nsid` text PRIMARY KEY,
	`authority_did` text NOT NULL,
	`cid` text,
	`doc` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `authority_updated_at_idx` ON `authority` (`updated_at`);--> statement-breakpoint
CREATE INDEX `schema_updated_at_idx` ON `schema` (`updated_at`);