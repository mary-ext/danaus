import type { CanonicalResourceUri, Cid, Nsid, RecordKey } from '@atcute/lexicons';

import { sql } from 'drizzle-orm';
import { blob, check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** stores repo's current commit */
export const repoRoot = sqliteTable(
	'repo_root',
	{
		id: integer().primaryKey().default(1),
		cid: text().$type<Cid>().notNull(),
		content: blob({ mode: 'buffer' }).notNull(),
		rev: text().notNull(),
	},
	(t) => [check(`single_row`, sql`${t.id} = 1`)],
);

/** repo blocks (MST nodes and record data) */
export const repoBlock = sqliteTable(
	'repo_block',
	{
		cid: text().$type<Cid>().primaryKey(),
		rev: text().notNull(),
		content: blob({ mode: 'buffer' }).notNull(),
	},
	(t) => [index('repo_block_rev_cid_idx').on(t.rev, t.cid)],
);

/** record index */
export const record = sqliteTable(
	'record',
	{
		uri: text().$type<CanonicalResourceUri>().primaryKey(),
		cid: text().$type<Cid>().notNull(),
		collection: text().$type<Nsid>().notNull(),
		rkey: text().$type<RecordKey>().notNull(),
		rev: text().notNull(),
		created_at: integer({ mode: 'timestamp' }).notNull(),
		takedown_ref: text(),
	},
	(t) => [
		index('record_cid_idx').on(t.cid),
		index('record_collection_idx').on(t.collection),
		index('record_rev_idx').on(t.rev),
	],
);

/** blob metadata */
const _blob = sqliteTable(
	'blob',
	{
		cid: text().$type<Cid>().primaryKey(),
		mime_type: text().notNull(),
		size: integer().notNull(),
		temp_key: text(),
		takedown_ref: text(),
		created_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [index('blob_tempkey_idx').on(t.temp_key)],
);

export { _blob as blob };

/** junction table linking blobs to records */
export const recordBlob = sqliteTable(
	'record_blob',
	{
		blob_cid: text()
			.$type<Cid>()
			.notNull()
			.references(() => _blob.cid, { onDelete: 'cascade' }),
		record_uri: text()
			.$type<CanonicalResourceUri>()
			.notNull()
			.references(() => record.uri, { onDelete: 'cascade' }),
	},
	(t) => [primaryKey({ columns: [t.blob_cid, t.record_uri] })],
);

export type LegacyAccountPref = Array<{ $type: string }>;

/** account preferences (app.bsky.actor.putPreferences, app.bsky.actor.getPreferences) */
export const legacyPref = sqliteTable(
	'legacy_pref',
	{
		id: integer().primaryKey().default(1),
		content: text({ mode: 'json' }).$type<LegacyAccountPref>().notNull(),
	},
	(t) => [check(`single_row`, sql`${t.id} = 1`)],
);
