import type { CanonicalResourceUri, Nsid, RecordKey } from '@atcute/lexicons';

import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm';

import type { ActorDbConnection } from '../actor-store-types';
import { t } from '../db';

/**
 * record list options.
 */
export interface ListRecordOptions {
	limit?: number;
	reverse?: boolean;
	cursor?: RecordKey;
}

/**
 * record index entry.
 */
export interface RecordIndexEntry {
	uri: CanonicalResourceUri;
	cid: string;
	collection: Nsid;
	rkey: RecordKey;
	rev: string;
	created_at: Date;
	takedown_ref: string | null;
}

/**
 * record index reader.
 */
export class RecordReader {
	protected readonly db: ActorDbConnection;

	/**
	 * create a record reader.
	 * @param db actor database handle
	 */
	constructor(db: ActorDbConnection) {
		this.db = db;
	}

	/**
	 * count total record entries.
	 * @returns record count
	 */
	recordCount(): number {
		const row = this.db
			.select({
				count: sql<number>`count(*)`,
			})
			.from(t.record)
			.get();

		return row?.count ?? 0;
	}

	/**
	 * list collections that have indexed records.
	 * @returns collection list
	 */
	listCollections(): Nsid[] {
		const rows = this.db
			.select({ collection: t.record.collection })
			.from(t.record)
			.groupBy(t.record.collection)
			.all();

		return rows.map((row) => row.collection);
	}

	/**
	 * fetch a record entry by uri.
	 * @param uri record uri
	 * @returns record entry or null
	 */
	getRecord(uri: CanonicalResourceUri): RecordIndexEntry | null {
		const row = this.db.select().from(t.record).where(eq(t.record.uri, uri)).get();

		return row ?? null;
	}

	/**
	 * fetch takedown status for a record.
	 * @param uri record uri
	 * @returns takedown status or null
	 */
	getRecordTakedownStatus(uri: CanonicalResourceUri): { applied: boolean; ref?: string } | null {
		const row = this.getRecord(uri);
		if (!row || row.takedown_ref === null) {
			return null;
		}

		return { applied: true, ref: row.takedown_ref ?? undefined };
	}

	/**
	 * fetch current record cid for a uri.
	 * @param uri record uri
	 * @returns record cid or null
	 */
	getCurrentRecordCid(uri: CanonicalResourceUri): string | null {
		return this.getRecord(uri)?.cid ?? null;
	}

	/**
	 * list indexed records for a collection.
	 * @param collection record collection
	 * @param options listing options
	 * @returns record entries
	 */
	listRecords(collection: Nsid, options: ListRecordOptions = {}): RecordIndexEntry[] {
		const limit = options.limit ?? 50;
		const reverse = options.reverse ?? false;

		const rows = this.db
			.select()
			.from(t.record)
			.where(
				and(
					eq(t.record.collection, collection),
					options.cursor
						? reverse
							? lt(t.record.rkey, options.cursor)
							: gt(t.record.rkey, options.cursor)
						: undefined,
				),
			)
			.orderBy(reverse ? desc(t.record.rkey) : asc(t.record.rkey))
			.limit(limit)
			.all();

		return rows;
	}
}
