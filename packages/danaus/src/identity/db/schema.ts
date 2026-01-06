import type { DidDocument } from '@atcute/identity';
import type { AtprotoDid, Handle } from '@atcute/lexicons/syntax';

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** cached handle resolutions */
export const handle = sqliteTable(
	'handle',
	{
		handle: text().$type<Handle>().primaryKey(),
		did: text().$type<AtprotoDid>().notNull(),
		updated_at: integer().notNull(),
	},
	(t) => [index('handle_updated_at_idx').on(t.updated_at)],
);

/** cached DID documents */
export const didDoc = sqliteTable(
	'did_doc',
	{
		did: text().$type<AtprotoDid>().primaryKey(),
		doc: text({ mode: 'json' }).$type<DidDocument>().notNull(),
		updated_at: integer().notNull(),
	},
	(t) => [index('did_doc_updated_at_idx').on(t.updated_at)],
);
