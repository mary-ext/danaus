import path from 'node:path';
import { Database } from 'bun:sqlite';

import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import * as schema from './schema.ts';

const relations = defineRelations(schema, (r) => ({
	account: {
		appPasswords: r.many.appPassword({
			from: r.account.did,
			to: r.appPassword.did,
		}),
		legacySessions: r.many.legacySession({
			from: r.account.did,
			to: r.legacySession.did,
		}),
		webSessions: r.many.webSession({
			from: r.account.did,
			to: r.webSession.did,
		}),
		emailTokens: r.many.emailToken({
			from: r.account.did,
			to: r.emailToken.did,
		}),
	},
	appPassword: {
		account: r.one.account({
			from: r.appPassword.did,
			to: r.account.did,
		}),
		legacySessions: r.many.legacySession({
			from: r.appPassword.id,
			to: r.legacySession.appPasswordId,
		}),
	},
	legacySession: {
		account: r.one.account({
			from: r.legacySession.did,
			to: r.account.did,
		}),
		appPassword: r.one.appPassword({
			from: r.legacySession.appPasswordId,
			to: r.appPassword.id,
		}),
		next: r.one.legacySession({
			from: r.legacySession.next_id,
			to: r.legacySession.id,
		}),
	},
	webSession: {
		account: r.one.account({
			from: r.webSession.did,
			to: r.account.did,
		}),
	},
	emailToken: {
		account: r.one.account({
			from: r.emailToken.did,
			to: r.account.did,
		}),
	},
	inviteCode: {
		uses: r.many.inviteCodeUse({
			from: r.inviteCode.code,
			to: r.inviteCodeUse.code,
		}),
	},
	inviteCodeUse: {
		inviteCode: r.one.inviteCode({
			from: r.inviteCodeUse.code,
			to: r.inviteCode.code,
		}),
		account: r.one.account({
			from: r.inviteCodeUse.used_by,
			to: r.account.did,
		}),
	},
}));

const MIGRATIONS_DIR = path.resolve(import.meta.dir, '../../../drizzle/accounts');

export const getAccountDb = (location: string, walAutoCheckpointDisabled: boolean) => {
	const sqliteDb = new Database(location);
	sqliteDb.run(`PRAGMA journal_mode = WAL;`);
	if (walAutoCheckpointDisabled) {
		sqliteDb.run(`PRAGMA wal_autocheckpoint = 0;`);
	}

	const db = drizzle({
		client: sqliteDb,
		schema: schema,
		relations: relations,
	});

	migrate(db, { migrationsFolder: MIGRATIONS_DIR });

	return db;
};

export type AccountDb = ReturnType<typeof getAccountDb>;

export { schema as t };
