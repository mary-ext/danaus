import type { LexiconDoc } from '@atcute/lexicon-doc';
import type { AtprotoDid, Nsid } from '@atcute/lexicons/syntax';

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * cached lexicon authority resolutions (NSID domain → authority DID).
 * `did` is null for negative cache entries (authority confirmed not to exist).
 */
export const authority = sqliteTable(
	'authority',
	{
		domain: text().primaryKey(),
		/** authority DID, or null if authority confirmed not to exist */
		did: text().$type<AtprotoDid | null>(),
		updated_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [index('authority_updated_at_idx').on(t.updated_at)],
);

/**
 * cached lexicon schemas.
 * `cid` and `doc` are null for negative cache entries (schema confirmed not to exist).
 */
export const schema = sqliteTable(
	'schema',
	{
		nsid: text().$type<Nsid>().primaryKey(),
		authority_did: text().$type<AtprotoDid>().notNull(),
		/** schema CID, or null if schema confirmed not to exist */
		cid: text().$type<string | null>(),
		/** schema document, or null if schema confirmed not to exist */
		doc: text({ mode: 'json' }).$type<LexiconDoc | null>(),
		updated_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [index('schema_updated_at_idx').on(t.updated_at)],
);
