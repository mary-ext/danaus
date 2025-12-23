import type { CanonicalResourceUri } from '@atcute/lexicons';
import { InvalidRequestError } from '@atcute/xrpc-server';

import { eq, inArray } from 'drizzle-orm';

import { chunked } from '#app/utils/misc.ts';

import type { ActorDbConnection } from '../actor-store-types';
import type { BlobStore } from '../blob-store/types';
import { t } from '../db';
import type { RepoBlobHandler, RepoBlobWriteOptions, RepoRecordWrite } from '../repo/side-effects';

import { BlobReader } from './reader';
import { findBlobReferences, type BlobReference } from './utils';

/**
 * blob metadata writer.
 */
export class BlobTransactor extends BlobReader implements RepoBlobHandler {
	/**
	 * create a blob writer.
	 * @param db actor database handle
	 * @param blobStore actor blob store
	 */
	constructor(db: ActorDbConnection, blobStore: BlobStore) {
		super(db, blobStore);
	}

	/**
	 * apply blob updates after persisting the commit.
	 * @param options blob update options
	 */
	async applyWrites(options: RepoBlobWriteOptions): Promise<void> {
		const { refs, recordBlobs } = this.collectWriteBlobRefs(options.writes);

		if (options.validateBlobs !== false) {
			this.assertValidBlobReferences(refs);
		}

		const affectedUris: CanonicalResourceUri[] = [
			...options.deletes.map((del) => del.uri),
			...options.writes.filter((write) => write.action === 'update').map((write) => write.uri),
		];

		const deletedBlobCids = this.removeRecordBlobLinks(affectedUris);
		this.insertRecordBlobLinks(recordBlobs);

		await this.makeBlobsPermanent(refs);
		await this.deleteOrphanedBlobs(deletedBlobCids);
	}

	private collectWriteBlobRefs(writes: RepoRecordWrite[]): {
		refs: Map<string, BlobReference>;
		recordBlobs: Array<{
			record_uri: CanonicalResourceUri;
			blob_cid: string;
		}>;
	} {
		const refs = new Map<string, BlobReference>();
		const recordBlobs: Array<{ record_uri: CanonicalResourceUri; blob_cid: string }> = [];

		for (const write of writes) {
			const recordRefs = findBlobReferences(write.record);
			for (const [cid, ref] of recordRefs) {
				refs.set(cid, ref);
				recordBlobs.push({
					record_uri: write.uri,
					blob_cid: cid,
				});
			}
		}

		return { refs, recordBlobs };
	}

	private assertValidBlobReferences(refs: Map<string, BlobReference>): void {
		if (refs.size === 0) {
			return;
		}

		const cids = Array.from(refs.keys());
		const rows = this.db
			.select({
				cid: t.blob.cid,
			})
			.from(t.blob)
			.where(inArray(t.blob.cid, cids))
			.all();

		const byCid = new Map(rows.map((row) => [row.cid, row]));

		for (const [cid, ref] of refs) {
			const row = byCid.get(cid);
			if (!row) {
				throw new InvalidRequestError({
					error: 'BlobNotFound',
					description: `blob not found: ${cid}`,
				});
			}

			void ref;
		}
	}

	private removeRecordBlobLinks(recordUris: CanonicalResourceUri[]): string[] {
		if (recordUris.length === 0) {
			return [];
		}

		const rows = this.db
			.select({ blobCid: t.recordBlob.blob_cid })
			.from(t.recordBlob)
			.where(inArray(t.recordBlob.record_uri, recordUris))
			.all();

		this.db.delete(t.recordBlob).where(inArray(t.recordBlob.record_uri, recordUris)).run();

		return Array.from(new Set(rows.map((row) => row.blobCid)));
	}

	private insertRecordBlobLinks(rows: Array<{ record_uri: CanonicalResourceUri; blob_cid: string }>): void {
		if (rows.length === 0) {
			return;
		}

		for (const batch of chunked(rows, 200)) {
			this.db
				.insert(t.recordBlob)
				.values(batch)
				.onConflictDoNothing({
					target: [t.recordBlob.blob_cid, t.recordBlob.record_uri],
				})
				.run();
		}
	}

	private async makeBlobsPermanent(refs: Map<string, BlobReference>): Promise<void> {
		if (refs.size === 0) {
			return;
		}

		const cids = Array.from(refs.keys());
		const rows = this.db
			.select({
				cid: t.blob.cid,
				tempKey: t.blob.temp_key,
			})
			.from(t.blob)
			.where(inArray(t.blob.cid, cids))
			.all();

		for (const row of rows) {
			if (!row.tempKey) {
				continue;
			}

			await this.blobStore.makePermanent(row.tempKey, row.cid);
			this.db.update(t.blob).set({ temp_key: null }).where(eq(t.blob.cid, row.cid)).run();
		}
	}

	private async deleteOrphanedBlobs(cids: string[]): Promise<void> {
		if (cids.length === 0) {
			return;
		}

		const referencedRows = this.db
			.select({ blobCid: t.recordBlob.blob_cid })
			.from(t.recordBlob)
			.where(inArray(t.recordBlob.blob_cid, cids))
			.all();

		const referenced = new Set(referencedRows.map((row) => row.blobCid));
		const deleteCids = cids.filter((cid) => !referenced.has(cid));

		if (deleteCids.length === 0) {
			return;
		}

		for (const batch of chunked(deleteCids, 200)) {
			this.db.delete(t.blob).where(inArray(t.blob.cid, batch)).run();
		}

		await this.blobStore.deleteMany(deleteCids);
	}

	/**
	 * update takedown status for a blob.
	 * @param cid blob cid
	 * @param takedown takedown status
	 */
	updateBlobTakedownStatus(cid: string, takedown: { applied: boolean; ref?: string }): void {
		const ref = takedown.applied ? (takedown.ref ?? 'admin') : null;
		this.db.update(t.blob).set({ takedown_ref: ref }).where(eq(t.blob.cid, cid)).run();
	}
}
