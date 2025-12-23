CREATE TABLE `blob` (
	`cid` text PRIMARY KEY,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`temp_key` text,
	`takedown_ref` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `legacy_pref` (
	`id` integer PRIMARY KEY DEFAULT 1,
	`content` text NOT NULL,
	CONSTRAINT "single_row" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `record` (
	`uri` text PRIMARY KEY,
	`cid` text NOT NULL,
	`collection` text NOT NULL,
	`rkey` text NOT NULL,
	`rev` text NOT NULL,
	`created_at` integer NOT NULL,
	`takedown_ref` text
);
--> statement-breakpoint
CREATE TABLE `record_blob` (
	`blob_cid` text NOT NULL,
	`record_uri` text NOT NULL,
	CONSTRAINT `record_blob_pk` PRIMARY KEY(`blob_cid`, `record_uri`),
	CONSTRAINT `fk_record_blob_blob_cid_blob_cid_fk` FOREIGN KEY (`blob_cid`) REFERENCES `blob`(`cid`) ON DELETE CASCADE,
	CONSTRAINT `fk_record_blob_record_uri_record_uri_fk` FOREIGN KEY (`record_uri`) REFERENCES `record`(`uri`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `repo_block` (
	`cid` text PRIMARY KEY,
	`rev` text NOT NULL,
	`content` blob NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repo_root` (
	`id` integer PRIMARY KEY DEFAULT 1,
	`cid` text NOT NULL,
	`content` blob NOT NULL,
	`rev` text NOT NULL,
	CONSTRAINT "single_row" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE INDEX `blob_tempkey_idx` ON `blob` (`temp_key`);--> statement-breakpoint
CREATE INDEX `record_cid_idx` ON `record` (`cid`);--> statement-breakpoint
CREATE INDEX `record_collection_idx` ON `record` (`collection`);--> statement-breakpoint
CREATE INDEX `record_rev_idx` ON `record` (`rev`);--> statement-breakpoint
CREATE INDEX `repo_block_rev_cid_idx` ON `repo_block` (`rev`,`cid`);