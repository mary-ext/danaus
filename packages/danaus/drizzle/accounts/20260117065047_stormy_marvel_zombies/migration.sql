CREATE TABLE `account` (
	`did` text PRIMARY KEY,
	`handle` text,
	`created_at` integer NOT NULL,
	`takedown_ref` text,
	`deactivated_at` integer,
	`delete_at` integer,
	`password_hash` text NOT NULL,
	`password_updated_at` integer,
	`email` text NOT NULL,
	`email_confirmed_at` integer,
	`preferred_mfa` integer
);
--> statement-breakpoint
CREATE TABLE `app_password` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`did` text NOT NULL,
	`name` text NOT NULL,
	`privilege` integer NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_app_password_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE,
	CONSTRAINT `app_password_did_name_unique` UNIQUE(`did`,`name`)
);
--> statement-breakpoint
CREATE TABLE `email_token` (
	`did` text NOT NULL,
	`purpose` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `email_token_pk` PRIMARY KEY(`did`, `purpose`),
	CONSTRAINT `fk_email_token_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `invite_code` (
	`code` text PRIMARY KEY,
	`available_uses` integer DEFAULT 1 NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invite_code_use` (
	`code` text NOT NULL,
	`used_by` text NOT NULL,
	`used_at` integer NOT NULL,
	CONSTRAINT `invite_code_use_pk` PRIMARY KEY(`code`, `used_by`),
	CONSTRAINT `fk_invite_code_use_code_invite_code_code_fk` FOREIGN KEY (`code`) REFERENCES `invite_code`(`code`) ON DELETE CASCADE,
	CONSTRAINT `fk_invite_code_use_used_by_account_did_fk` FOREIGN KEY (`used_by`) REFERENCES `account`(`did`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `legacy_session` (
	`id` text PRIMARY KEY,
	`did` text NOT NULL,
	`app_password_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`next_id` text,
	CONSTRAINT `fk_legacy_session_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE,
	CONSTRAINT `fk_legacy_session_app_password_id_app_password_id_fk` FOREIGN KEY (`app_password_id`) REFERENCES `app_password`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_legacy_session_next_id_legacy_session_id_fk` FOREIGN KEY (`next_id`) REFERENCES `legacy_session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `recovery_code` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`did` text NOT NULL,
	`code` text NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_recovery_code_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `totp_credential` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`did` text NOT NULL,
	`name` text NOT NULL,
	`secret` blob NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_counter` integer NOT NULL,
	CONSTRAINT `fk_totp_credential_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE,
	CONSTRAINT `totp_credential_did_name_unique` UNIQUE(`did`,`name`)
);
--> statement-breakpoint
CREATE TABLE `verify_challenge` (
	`token` text PRIMARY KEY,
	`did` text NOT NULL,
	`session_id` text,
	`remember` integer DEFAULT false NOT NULL,
	`webauthn_challenge` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `fk_verify_challenge_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE,
	CONSTRAINT `fk_verify_challenge_session_id_web_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `web_session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `web_session` (
	`id` text PRIMARY KEY,
	`did` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`sudo_at` integer,
	CONSTRAINT `fk_web_session_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `webauthn_challenge` (
	`token` text PRIMARY KEY,
	`did` text NOT NULL,
	`challenge` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT `fk_webauthn_challenge_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `webauthn_credential` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`did` text NOT NULL,
	`type` integer NOT NULL,
	`name` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer NOT NULL,
	`transports` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_webauthn_credential_did_account_did_fk` FOREIGN KEY (`did`) REFERENCES `account`(`did`) ON DELETE CASCADE,
	CONSTRAINT `webauthn_credential_did_name_unique` UNIQUE(`did`,`name`)
);
--> statement-breakpoint
CREATE INDEX `account_created_at_did_idx` ON `account` (`created_at`,`did`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_handle_lower_idx` ON `account` (lower("handle"));--> statement-breakpoint
CREATE UNIQUE INDEX `account_email_lower_idx` ON `account` (lower("email"));--> statement-breakpoint
CREATE INDEX `legacy_session_did_idx` ON `legacy_session` (`did`);--> statement-breakpoint
CREATE INDEX `recovery_code_did_idx` ON `recovery_code` (`did`);--> statement-breakpoint
CREATE INDEX `totp_credential_did_idx` ON `totp_credential` (`did`);--> statement-breakpoint
CREATE INDEX `verify_challenge_expires_idx` ON `verify_challenge` (`expires_at`);--> statement-breakpoint
CREATE INDEX `web_session_did_idx` ON `web_session` (`did`);--> statement-breakpoint
CREATE INDEX `webauthn_challenge_expires_idx` ON `webauthn_challenge` (`expires_at`);--> statement-breakpoint
CREATE INDEX `webauthn_credential_did_idx` ON `webauthn_credential` (`did`);--> statement-breakpoint
CREATE UNIQUE INDEX `webauthn_credential_id_idx` ON `webauthn_credential` (`credential_id`);