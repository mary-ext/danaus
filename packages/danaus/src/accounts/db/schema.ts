import type { Did, Handle } from '@atcute/lexicons/syntax';

import { sql } from 'drizzle-orm';
import {
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	unique,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

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
