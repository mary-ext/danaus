import path from 'node:path';
import { Database } from 'bun:sqlite';

import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import * as schema from './schema.ts';

const relations = defineRelations(schema, (r) => ({
	record: {
		recordBlobs: r.many.recordBlob({
			from: r.record.uri,
			to: r.recordBlob.record_uri,
		}),
	},
	blob: {
		recordBlobs: r.many.recordBlob({
			from: r.blob.cid,
			to: r.recordBlob.blob_cid,
		}),
	},
	recordBlob: {
		record: r.one.record({
			from: r.recordBlob.record_uri,
			to: r.record.uri,
		}),
		blob: r.one.blob({
			from: r.recordBlob.blob_cid,
			to: r.blob.cid,
		}),
	},
}));

const MIGRATIONS_DIR = path.resolve(import.meta.dir, '../../../drizzle/actors');

export const getActorDb = (location: string, walAutoCheckpointDisabled: boolean) => {
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

export type ActorDb = ReturnType<typeof getActorDb>;

export { schema as t };
