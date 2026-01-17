import type { Did, Handle } from '@atcute/lexicons/syntax';

import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { sql } from 'drizzle-orm';
import {
	blob,
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	unique,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** preferred MFA method */
export const enum PreferredMfa {
	/** TOTP authenticator app */
	Totp = 0,
	/** WebAuthn security key */
	WebAuthn = 1,
}

/** user accounts */
export const account = sqliteTable(
	'account',
	{
		did: text().$type<Did>().primaryKey(),
		handle: text().$type<Handle>(),
		created_at: integer({ mode: 'timestamp' }).notNull(),

		takedown_ref: text(),
		deactivated_at: integer({ mode: 'timestamp' }),
		delete_at: integer({ mode: 'timestamp' }),

		password_hash: text().notNull(),
		password_updated_at: integer({ mode: 'timestamp' }),

		email: text().notNull(),
		email_confirmed_at: integer({ mode: 'timestamp' }),

		/** preferred MFA method (null = no MFA configured) */
		preferred_mfa: integer().$type<PreferredMfa>(),
	},
	(t) => [
		index('account_created_at_did_idx').on(t.created_at, t.did),
		uniqueIndex('account_handle_lower_idx').on(sql`lower(${t.handle})`),
		uniqueIndex('account_email_lower_idx').on(sql`lower(${t.email})`),
	],
);

/** app password privilege levels */
export const enum AppPasswordPrivilege {
	Limited = 0,
	Privileged = 1,
	Full = 2,
}

/** app passwords used to sign into legacy auth */
export const appPassword = sqliteTable(
	'app_password',
	{
		id: integer().primaryKey({ autoIncrement: true }),

		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),
		name: text('name').notNull(),

		privilege: integer().$type<AppPasswordPrivilege>().notNull(),
		password_hash: text().notNull(),

		created_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [unique().on(t.did, t.name)],
);

/** legacy sessions */
export const legacySession = sqliteTable(
	'legacy_session',
	{
		id: text().primaryKey(),

		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),
		appPasswordId: integer('app_password_id')
			.notNull()
			.references(() => appPassword.id, { onDelete: 'cascade' }),

		created_at: integer({ mode: 'timestamp' }).notNull(),
		expires_at: integer({ mode: 'timestamp' }).notNull(),

		next_id: text(),
	},
	(t) => [
		foreignKey({ columns: [t.next_id], foreignColumns: [t.id] }).onDelete('cascade'),
		index('legacy_session_did_idx').on(t.did),
	],
);

/** web session metadata */
export interface WebSessionInfo {
	userAgent: string | undefined;
	ip: string | undefined;
}

/** web sessions */
export const webSession = sqliteTable(
	'web_session',
	{
		id: text().primaryKey(),

		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),
		metadata: text({ mode: 'json' }).$type<WebSessionInfo>().notNull(),

		created_at: integer({ mode: 'timestamp' }).notNull(),
		expires_at: integer({ mode: 'timestamp' }).notNull(),

		/** when sudo mode was last activated (null = not in sudo mode) */
		sudo_at: integer({ mode: 'timestamp' }),
	},
	(t) => [index('web_session_did_idx').on(t.did)],
);

/** email token purpose */
export const enum EmailTokenPurpose {
	EmailVerify = 0,
	EmailUpdate = 1,
	PasswordReset = 2,
	AccountDelete = 3,
}

/** email tokens */
export const emailToken = sqliteTable(
	'email_token',
	{
		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),
		purpose: integer().$type<EmailTokenPurpose>().notNull(),

		token: text().notNull(),

		created_at: integer({ mode: 'timestamp' }).notNull(),
		expires_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [primaryKey({ columns: [t.did, t.purpose] })],
);

/** invite codes */
export const inviteCode = sqliteTable('invite_code', {
	code: text().primaryKey(),
	available_uses: integer().notNull().default(1),
	disabled: integer({ mode: 'boolean' }).notNull().default(false),
	created_at: integer({ mode: 'timestamp' }).notNull(),
});

/** invite code usage tracking */
export const inviteCodeUse = sqliteTable(
	'invite_code_use',
	{
		code: text()
			.notNull()
			.references(() => inviteCode.code, { onDelete: 'cascade' }),
		used_by: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),
		used_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [primaryKey({ columns: [t.code, t.used_by] })],
);

// #region TOTP two-factor authentication

/** TOTP credentials for two-factor authentication */
export const totpCredential = sqliteTable(
	'totp_credential',
	{
		id: integer().primaryKey({ autoIncrement: true }),

		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),

		/** user-provided or auto-generated name */
		name: text().notNull(),
		/** 20-byte TOTP secret */
		secret: blob({ mode: 'buffer' }).notNull(),

		created_at: integer({ mode: 'timestamp' }).notNull(),
		/** last TOTP counter value used (prevents replay attacks) */
		last_used_counter: integer().notNull(),
	},
	(t) => [index('totp_credential_did_idx').on(t.did), unique().on(t.did, t.name)],
);

/** backup codes for account recovery */
export const recoveryCode = sqliteTable(
	'recovery_code',
	{
		id: integer().primaryKey({ autoIncrement: true }),

		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),

		/** plaintext recovery code */
		code: text().notNull(),

		used_at: integer({ mode: 'timestamp' }),
		created_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [index('recovery_code_did_idx').on(t.did)],
);

/**
 * verification challenges for MFA login and sudo elevation.
 * - session_id null → MFA login flow (creates new session on success)
 * - session_id set → sudo flow (elevates existing session on success)
 */
export const verifyChallenge = sqliteTable(
	'verify_challenge',
	{
		token: text().primaryKey(),

		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),

		/** session to elevate (null = MFA login, creates new session) */
		session_id: text().references(() => webSession.id, { onDelete: 'cascade' }),

		/** remember me preference from login form (MFA login only) */
		remember: integer({ mode: 'boolean' }).notNull().default(false),

		/** WebAuthn challenge (base64url) for authentication */
		webauthn_challenge: text(),

		created_at: integer({ mode: 'timestamp' }).notNull(),
		expires_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [index('verify_challenge_expires_idx').on(t.expires_at)],
);

// #endregion

// #region WebAuthn credentials

/** WebAuthn credential types */
export const enum WebAuthnCredentialType {
	/** security key - non-discoverable, 2FA only */
	SecurityKey = 0,
	/** passkey - discoverable, can be used for passwordless (future) */
	Passkey = 1,
}

/** WebAuthn credentials for security keys and passkeys */
export const webauthnCredential = sqliteTable(
	'webauthn_credential',
	{
		id: integer().primaryKey({ autoIncrement: true }),

		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),

		/** credential type: security key or passkey */
		type: integer().$type<WebAuthnCredentialType>().notNull(),
		/** user-provided name */
		name: text().notNull(),

		/** base64url-encoded credential ID */
		credential_id: text().notNull(),
		/** COSE public key (binary) */
		public_key: blob({ mode: 'buffer' }).notNull(),
		/** signature counter for replay detection */
		counter: integer().notNull(),
		/** transport hints */
		transports: text({ mode: 'json' }).$type<AuthenticatorTransportFuture[]>(),

		created_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [
		index('webauthn_credential_did_idx').on(t.did),
		unique().on(t.did, t.name),
		uniqueIndex('webauthn_credential_id_idx').on(t.credential_id),
	],
);

/** WebAuthn registration challenges */
export const webauthnChallenge = sqliteTable(
	'webauthn_challenge',
	{
		token: text().primaryKey(),

		did: text()
			.$type<Did>()
			.notNull()
			.references(() => account.did, { onDelete: 'cascade' }),

		/** base64url challenge */
		challenge: text().notNull(),

		created_at: integer({ mode: 'timestamp' }).notNull(),
		expires_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [index('webauthn_challenge_expires_idx').on(t.expires_at)],
);

// #endregion
