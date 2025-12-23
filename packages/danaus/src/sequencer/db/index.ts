import path from 'node:path';
import { Database } from 'bun:sqlite';

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import * as schema from './schema';

const MIGRATIONS_DIR = path.resolve(import.meta.dir, '../../../drizzle/sequencer');

export const getSequencerDb = (location: string, walAutoCheckpointDisabled: boolean) => {
	const sqliteDb = new Database(location);
	sqliteDb.run(`PRAGMA journal_mode = WAL;`);
	if (walAutoCheckpointDisabled) {
		sqliteDb.run(`PRAGMA wal_autocheckpoint = 0;`);
	}

	const db = drizzle({
		client: sqliteDb,
		schema: schema,
	});

	migrate(db, { migrationsFolder: MIGRATIONS_DIR });

	return db;
};

export type SequencerDb = ReturnType<typeof getSequencerDb>;

export { schema as t };
