import type { CanonicalResourceUri } from '@atcute/lexicons';

import { and, asc, eq, gt } from 'drizzle-orm';

import type { ActorDbConnection } from '../actor-store-types';
import type { BlobStore } from '../blob-store/types';
import { t } from '../db';

/**
 * blob metadata.
 */
export interface BlobMetadata {
	cid: string;
	mimeType: string;
	size: number;
	tempKey: string | null;
	takedownRef: string | null;
	createdAt: Date;
}

/**
 * blob fetch result.
 */
export interface BlobResult {
	blob: Blob;
	metadata: BlobMetadata;
}

/**
 * list blobs options.
 */
export interface ListBlobsOptions {
	since?: string;
	cursor?: string;
	limit: number;
}

/**
 * blob metadata reader.
 */
export class BlobReader {
	protected readonly db: ActorDbConnection;
	protected readonly blobStore: BlobStore;

	/**
	 * create a blob reader.
	 * @param db actor database handle
	 * @param blobStore actor blob store
	 */
	constructor(db: ActorDbConnection, blobStore: BlobStore) {
		this.db = db;
		this.blobStore = blobStore;
	}

	/**
	 * fetch blob metadata by cid.
	 * @param cid blob cid
	 * @returns blob metadata or null
	 */
	getBlobMetadata(cid: string): BlobMetadata | null {
		const row = this.db
			.select({
				cid: t.blob.cid,
				mimeType: t.blob.mime_type,
				size: t.blob.size,
				tempKey: t.blob.temp_key,
				createdAt: t.blob.created_at,
				takedownRef: t.blob.takedown_ref,
			})
			.from(t.blob)
			.where(eq(t.blob.cid, cid))
			.get();

		return row ?? null;
	}

	/**
	 * fetch takedown status for a blob.
	 * @param cid blob cid
	 * @returns takedown status or null
	 */
	getBlobTakedownStatus(cid: string): { applied: boolean; ref?: string } | null {
		const row = this.getBlobMetadata(cid);
		if (!row || row.takedownRef === null) {
			return null;
		}

		return { applied: true, ref: row.takedownRef ?? undefined };
	}

	/**
	 * fetch blob content and metadata.
	 * @param cid blob cid
	 * @returns blob result or null
	 */
	async getBlob(cid: string): Promise<BlobResult | null> {
		const metadata = this.getBlobMetadata(cid);
		if (!metadata) {
			return null;
		}

		if (!(await this.blobStore.hasPermanent(cid))) {
			return null;
		}

		const blob = await this.blobStore.getBlob(cid);

		return { blob, metadata };
	}

	/**
	 * list blob cids.
	 * @param options listing options
	 * @returns blob cids
	 */
	listBlobs(options: ListBlobsOptions): string[] {
		const { since, cursor, limit } = options;

		if (since) {
			const rows = this.db
				.select({ blobCid: t.recordBlob.blob_cid })
				.from(t.recordBlob)
				.innerJoin(t.record, eq(t.record.uri, t.recordBlob.record_uri))
				.where(and(gt(t.record.rev, since), cursor ? gt(t.recordBlob.blob_cid, cursor) : undefined))
				.groupBy(t.recordBlob.blob_cid)
				.orderBy(asc(t.recordBlob.blob_cid))
				.limit(limit)
				.all();

			return rows.map((row) => row.blobCid);
		}

		const rows = this.db
			.select({ blobCid: t.recordBlob.blob_cid })
			.from(t.recordBlob)
			.where(cursor ? gt(t.recordBlob.blob_cid, cursor) : undefined)
			.groupBy(t.recordBlob.blob_cid)
			.orderBy(asc(t.recordBlob.blob_cid))
			.limit(limit)
			.all();

		return rows.map((row) => row.blobCid);
	}

	/**
	 * list record uris that reference a blob.
	 * @param cid blob cid
	 * @returns record uris
	 */
	getRecordsForBlob(cid: string): CanonicalResourceUri[] {
		const rows = this.db
			.select({ recordUri: t.recordBlob.record_uri })
			.from(t.recordBlob)
			.where(eq(t.recordBlob.blob_cid, cid))
			.all();

		return rows.map((row) => row.recordUri);
	}

	/**
	 * list blob cids referenced by a record.
	 * @param recordUri record uri
	 * @returns blob cids
	 */
	getBlobsForRecord(recordUri: CanonicalResourceUri): string[] {
		const rows = this.db
			.select({ blobCid: t.recordBlob.blob_cid })
			.from(t.recordBlob)
			.where(eq(t.recordBlob.record_uri, recordUri))
			.all();

		return rows.map((row) => row.blobCid);
	}
}
