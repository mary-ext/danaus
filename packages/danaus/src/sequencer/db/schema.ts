import type { Did } from '@atcute/lexicons';

import { blob, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { RepoSeqEventType, StoredMessage } from '../types';

export const repoSeq = sqliteTable(
	'repo_seq',
	{
		seq: integer().primaryKey({ autoIncrement: true }),
		did: text().$type<Did>().notNull(),
		event_type: text().$type<RepoSeqEventType>().notNull(),
		event: text({ mode: 'json' }).$type<StoredMessage>().notNull(),
		blocks: blob({ mode: 'buffer' }),
		invalidated: integer().notNull().default(0),
		sequenced_at: integer({ mode: 'timestamp' }).notNull(),
	},
	(t) => [
		index('repo_seq_did_idx').on(t.did),
		index('repo_seq_event_type_idx').on(t.event_type),
		index('repo_seq_sequenced_at_idx').on(t.sequenced_at),
	],
);
