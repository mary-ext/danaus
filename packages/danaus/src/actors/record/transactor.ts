import type { CanonicalResourceUri } from '@atcute/lexicons';

import { eq, inArray, sql } from 'drizzle-orm';

import type { ActorDbConnection } from '../actor-store-types';
import { t } from '../db';
import type { RepoRecordIndexer } from '../repo/side-effects';

import { RecordReader } from './reader';
import type { RecordIndexUpsert } from './types';

/**
 * record index writer.
 */
export class RecordTransactor extends RecordReader implements RepoRecordIndexer {
	/**
	 * create a record writer.
	 * @param db actor database handle
	 */
	constructor(db: ActorDbConnection) {
		super(db);
	}

	/**
	 * upsert record index entries.
	 * @param records record index entries
	 */
	upsertRecords(records: RecordIndexUpsert[]): void {
		if (records.length === 0) {
			return;
		}

		this.db
			.insert(t.record)
			.values(records)
			.onConflictDoUpdate({
				target: t.record.uri,
				set: {
					cid: sql`excluded.cid`,
					collection: sql`excluded.collection`,
					rkey: sql`excluded.rkey`,
					rev: sql`excluded.rev`,
					created_at: sql`excluded.created_at`,
				},
			})
			.run();
	}

	/**
	 * delete record index entries.
	 * @param uris record uris to delete
	 */
	deleteRecords(uris: CanonicalResourceUri[]): void {
		if (uris.length === 0) {
			return;
		}

		this.db.delete(t.record).where(inArray(t.record.uri, uris)).run();
	}

	/**
	 * update takedown status for a record.
	 * @param uri record uri
	 * @param takedown takedown status
	 */
	updateRecordTakedownStatus(uri: CanonicalResourceUri, takedown: { applied: boolean; ref?: string }): void {
		const ref = takedown.applied ? (takedown.ref ?? 'admin') : null;
		this.db.update(t.record).set({ takedown_ref: ref }).where(eq(t.record.uri, uri)).run();
	}
}
