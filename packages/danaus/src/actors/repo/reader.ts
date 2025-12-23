import * as CBOR from '@atcute/cbor';
import type { Nsid, RecordKey } from '@atcute/lexicons';

import { and, asc, desc, eq, gt, inArray, lt } from 'drizzle-orm';

import { mapDefined } from '#app/utils/misc.ts';

import type { ActorDbConnection } from '../actor-store-types';
import type { BlobStore } from '../blob-store/types';
import { t } from '../db';

import { decodeCommit } from './commit';
import type { ListRecordsOptions, RepoRecordEntry, RepoRecordInfo, RepoRoot } from './types';

/**
 * repo reader.
 */
export class RepoReader {
	protected readonly db: ActorDbConnection;
	protected readonly blobStore: BlobStore;

	/**
	 * create a repo reader.
	 * @param db actor database handle
	 * @param blobStore actor blob store
	 */
	constructor(db: ActorDbConnection, blobStore: BlobStore) {
		this.db = db;
		this.blobStore = blobStore;
	}

	/**
	 * fetch the current repo root commit.
	 * @returns repo root info, or null when missing
	 */
	getRoot(): RepoRoot | null {
		const row = this.db.select().from(t.repoRoot).get();
		if (!row) {
			return null;
		}

		const bytes = row.content;
		const commit = decodeCommit(bytes);

		return {
			cid: row.cid,
			rev: row.rev,
			commit: commit,
			bytes: bytes,
		};
	}

	/**
	 * fetch a single record by collection and rkey.
	 * @param collection record collection
	 * @param rkey record key
	 * @returns record entry or null
	 */
	getRecord(collection: Nsid, rkey: RecordKey): RepoRecordEntry | null {
		const row = this.db
			.select({ uri: t.record.uri, cid: t.record.cid })
			.from(t.record)
			.where(and(eq(t.record.collection, collection), eq(t.record.rkey, rkey)))
			.get();

		if (!row) {
			return null;
		}

		const bytes = this.getBlock(row.cid);
		if (!bytes) {
			return null;
		}

		return {
			uri: row.uri,
			cid: row.cid,
			record: CBOR.decode(bytes),
		};
	}

	/**
	 * list records in a collection.
	 * @param collection record collection
	 * @param options listing options
	 * @returns record entries
	 */
	listRecords(collection: Nsid, options: ListRecordsOptions = {}): Array<RepoRecordEntry | RepoRecordInfo> {
		const limit = options.limit ?? 50;
		const reverse = options.reverse ?? false;

		const query = this.db
			.select({ uri: t.record.uri, cid: t.record.cid, rkey: t.record.rkey })
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
			.limit(limit);

		const rows = query.all();
		if (!options.includeRecords) {
			return rows.map((row) => ({ uri: row.uri, cid: row.cid }));
		}

		const blocks = this.getBlocks(rows.map((row) => row.cid));

		return mapDefined(rows, (row): RepoRecordEntry | undefined => {
			const bytes = blocks.get(row.cid);
			if (!bytes) {
				return;
			}

			return {
				uri: row.uri,
				cid: row.cid,
				record: CBOR.decode(bytes),
			};
		});
	}

	/**
	 * fetch blocks by cid.
	 * @param cids block cids
	 * @returns block map
	 */
	getBlocksByCid(cids: string[]): Map<string, Uint8Array> {
		return this.getBlocks(cids);
	}

	/**
	 * list all repo blocks.
	 * @returns block map
	 */
	listBlocks(): Map<string, Uint8Array> {
		const rows = this.db
			.select({ cid: t.repoBlock.cid, content: t.repoBlock.content })
			.from(t.repoBlock)
			.all();

		const map = new Map<string, Uint8Array>();
		for (const row of rows) {
			map.set(row.cid, new Uint8Array(row.content));
		}

		return map;
	}

	protected getBlock(cid: string): Uint8Array | null {
		const row = this.db
			.select({ content: t.repoBlock.content })
			.from(t.repoBlock)
			.where(eq(t.repoBlock.cid, cid))
			.get();

		const content = row?.content;
		return content ? new Uint8Array(content) : null;
	}

	protected getBlocks(cids: string[]): Map<string, Uint8Array> {
		if (cids.length === 0) {
			return new Map();
		}

		const rows = this.db
			.select({ cid: t.repoBlock.cid, content: t.repoBlock.content })
			.from(t.repoBlock)
			.where(inArray(t.repoBlock.cid, cids))
			.all();

		const map = new Map<string, Uint8Array>();
		for (const row of rows) {
			map.set(row.cid, new Uint8Array(row.content));
		}

		if (map.size !== cids.length) {
			const root = this.getRoot();
			if (root && cids.includes(root.cid) && !map.has(root.cid)) {
				map.set(root.cid, new Uint8Array(root.bytes));
			}
		}

		return map;
	}
}
