import { Buffer } from 'node:buffer';

import * as CBOR from '@atcute/cbor';
import * as CID from '@atcute/cid';
import type { PrivateKey } from '@atcute/crypto';
import type { Did, Nsid, RecordKey } from '@atcute/lexicons';
import {
	buildExclusionProof,
	DeltaType,
	MemoryBlockStore,
	mstDiff,
	MSTNode,
	NodeStore,
	NodeWalker,
	NodeWrangler,
	OverlayBlockStore,
	recordDiff,
} from '@atcute/mst';
import * as TID from '@atcute/tid';
import { InvalidRequestError } from '@atcute/xrpc-server';

import { inArray } from 'drizzle-orm';

import { chunked } from '#app/utils/misc.ts';

import type { ActorDbConnection } from '../actor-store-types';
import type { BlobStore } from '../blob-store/types';
import { t } from '../db';
import type { RecordIndexUpsert } from '../record/types';

import { SqlRepoReadonlyBlockStore } from './block-store';
import { encodeCommit } from './commit';
import { RepoReader } from './reader';
import type { RepoCommitOp, RepoRecordDelete, RepoRecordWrite, RepoSideEffects } from './side-effects';
import type { ApplyWritesOptions, ApplyWritesResult, RepoWriteOp, RepoWriteResult } from './types';

/**
 * repo writer.
 */
export class RepoTransactor extends RepoReader {
	protected readonly did: Did;
	protected readonly keypair: PrivateKey;
	private readonly sideEffects: RepoSideEffects;

	/**
	 * create a repo writer.
	 * @param db actor database handle
	 * @param blobStore actor blob store
	 * @param did actor did
	 * @param keypair repo signing key
	 * @param sideEffects repo side effect handlers
	 */
	constructor(
		db: ActorDbConnection,
		blobStore: BlobStore,
		did: Did,
		keypair: PrivateKey,
		sideEffects: RepoSideEffects,
	) {
		super(db, blobStore);
		this.did = did;
		this.keypair = keypair;
		this.sideEffects = sideEffects;
	}

	/**
	 * create a new repo root with optional initial writes.
	 * @param writes write operations
	 * @param options apply options
	 * @returns apply result
	 */
	async createRepo(writes: RepoWriteOp[] = [], options: ApplyWritesOptions = {}): Promise<ApplyWritesResult> {
		return await this.applyWritesInternal(writes, {
			swapCommit: null,
			create: true,
			validateBlobs: options.validateBlobs ?? true,
			emitSequencer: options.emitSequencer ?? true,
		});
	}

	/**
	 * apply a batch of repo writes.
	 * @param writes write operations
	 * @param options apply options
	 * @returns apply result
	 */
	async applyWrites(writes: RepoWriteOp[], options: ApplyWritesOptions = {}): Promise<ApplyWritesResult> {
		return await this.applyWritesInternal(writes, {
			swapCommit: options.swapCommit ?? undefined,
			validateBlobs: options.validateBlobs ?? true,
			emitSequencer: options.emitSequencer ?? true,
		});
	}

	/**
	 * create a single record.
	 * @param collection record collection
	 * @param record record value
	 * @param rkey optional record key
	 * @returns apply result
	 */
	async createRecord(collection: Nsid, record: unknown, rkey?: RecordKey): Promise<ApplyWritesResult> {
		return await this.applyWrites([
			{
				action: 'create',
				collection: collection,
				rkey: rkey,
				record: record,
			},
		]);
	}

	/**
	 * put a single record.
	 * @param collection record collection
	 * @param rkey record key
	 * @param record record value
	 * @returns apply result
	 */
	async putRecord(collection: Nsid, rkey: RecordKey, record: unknown): Promise<ApplyWritesResult> {
		return await this.applyWrites([
			{
				action: 'update',
				collection: collection,
				rkey: rkey,
				record: record,
			},
		]);
	}

	/**
	 * delete a single record.
	 * @param collection record collection
	 * @param rkey record key
	 * @returns apply result
	 */
	async deleteRecord(collection: Nsid, rkey: RecordKey): Promise<ApplyWritesResult> {
		return await this.applyWrites([
			{
				action: 'delete',
				collection: collection,
				rkey: rkey,
			},
		]);
	}

	private async applyWritesInternal(
		writes: RepoWriteOp[],
		options: ApplyWritesOptions & { create?: boolean; validateBlobs?: boolean; emitSequencer?: boolean },
	): Promise<ApplyWritesResult> {
		if (writes.length === 0 && !options.create) {
			throw new InvalidRequestError({ error: 'InvalidRequest', description: `no writes provided` });
		}
		if (writes.length > 200) {
			throw new InvalidRequestError({ error: 'TooManyWrites', description: `too many writes` });
		}

		const existingRoot = this.getRoot();
		if (!existingRoot && !options.create) {
			throw new InvalidRequestError({ error: 'RepoNotFound', description: `repository not found` });
		}
		if (existingRoot && options.create) {
			throw new InvalidRequestError({ error: 'RepoAlreadyExists', description: `repository already exists` });
		}

		if (options.swapCommit && existingRoot && existingRoot.cid !== options.swapCommit) {
			throw new InvalidRequestError({
				error: 'InvalidSwap',
				description: `swapCommit did not match current head`,
			});
		}

		const rev = TID.now();
		const now = new Date();

		const memoryStore = new MemoryBlockStore();
		const repoStore = new SqlRepoReadonlyBlockStore(this.db);
		const overlay = new OverlayBlockStore(memoryStore, repoStore);
		const nodeStore = new NodeStore(overlay);
		const wrangler = new NodeWrangler(nodeStore);

		const prevRootCid = existingRoot?.commit.data.$link ?? null;
		const prevRev = existingRoot?.commit.rev ?? null;
		let rootCid = prevRootCid;

		const recordBlocks = new Map<string, Uint8Array>();
		const recordIndexUpserts: RecordIndexUpsert[] = [];
		const recordWrites: RepoRecordWrite[] = [];
		const recordDeletes: RepoRecordDelete[] = [];
		const results: RepoWriteResult[] = [];
		const commitOps: RepoCommitOp[] = [];

		for (const write of writes) {
			const rkey = (write.rkey ?? (write.action === 'create' ? TID.now() : undefined)) as
				| RecordKey
				| undefined;
			if (!rkey) {
				throw new InvalidRequestError({
					error: 'InvalidRequest',
					description: `record key is required for update or delete`,
				});
			}

			const path: `${Nsid}/${RecordKey}` = `${write.collection}/${rkey}`;
			const walker = await NodeWalker.create(nodeStore, rootCid);
			const prevValue = await walker.findRpath(path);
			const prevCid = prevValue ? prevValue.$link : null;

			if (write.swapRecord !== undefined && write.swapRecord !== prevCid) {
				throw new InvalidRequestError({ error: 'InvalidSwap', description: `swapRecord did not match` });
			}

			if (write.action === 'create') {
				if (prevCid !== null) {
					throw new InvalidRequestError({
						error: 'RecordAlreadyExists',
						description: `record already exists`,
					});
				}
			} else if (write.action === 'update') {
				if (prevCid === null) {
					throw new InvalidRequestError({ error: 'RecordNotFound', description: `record not found` });
				}
			} else if (write.action === 'delete') {
				if (prevCid === null) {
					throw new InvalidRequestError({ error: 'RecordNotFound', description: `record not found` });
				}
			}

			if (write.action === 'delete') {
				rootCid = await wrangler.deleteRecord(rootCid, path);
				results.push({
					action: 'delete',
					uri: `at://${this.did}/${path}`,
					cid: null,
				});
				commitOps.push({
					action: 'delete',
					path: path,
					cid: null,
					prev: prevCid,
				});
				recordDeletes.push({
					uri: `at://${this.did}/${path}`,
					collection: write.collection,
					rkey: rkey,
				});
				continue;
			}

			const recordBytes = CBOR.encode(write.record);
			const recordCid = await CID.create(0x71, recordBytes);
			const recordLink = CID.toCidLink(recordCid);

			rootCid = await wrangler.putRecord(rootCid, path, recordLink);

			const recordCidStr = CID.toString(recordCid);
			recordBlocks.set(recordCidStr, recordBytes);
			results.push({
				action: write.action,
				uri: `at://${this.did}/${path}`,
				cid: recordCidStr,
			});
			commitOps.push({
				action: write.action,
				path: path,
				cid: recordCidStr,
				prev: write.action === 'update' ? prevCid : null,
			});
			recordIndexUpserts.push({
				uri: `at://${this.did}/${path}`,
				collection: write.collection,
				rkey: rkey,
				cid: recordCidStr,
				rev: rev,
				created_at: now,
			});
			recordWrites.push({
				action: write.action,
				uri: `at://${this.did}/${path}`,
				collection: write.collection,
				rkey: rkey,
				cid: recordCidStr,
				record: write.record,
			});
		}

		if (!rootCid) {
			const emptyNode = MSTNode.empty();
			const emptyCid = await emptyNode.cid();
			rootCid = emptyCid.$link;
			await memoryStore.put(rootCid, await emptyNode.serialize());
		}

		const commit = await encodeCommit({
			did: this.did,
			data: rootCid,
			rev: rev,
			signingKey: this.keypair,
		});

		const commitBlocks = await this.buildCommitBlocks(
			nodeStore,
			rootCid,
			commit.cid,
			commit.bytes,
			memoryStore.blocks,
			recordBlocks,
			recordDeletes,
		);

		this.persistRepoRoot(commit.cid, commit.bytes, rev);
		this.persistRepoBlocks(memoryStore.blocks, rev);
		this.persistRepoBlocks(recordBlocks, rev);
		await this.pruneRepoBlocks(nodeStore, prevRootCid, rootCid);

		const deleteUris = recordDeletes.map((record) => record.uri);
		await this.sideEffects.recordIndexer.upsertRecords(recordIndexUpserts);
		await this.sideEffects.recordIndexer.deleteRecords(deleteUris);

		await this.sideEffects.blobHandler.applyWrites({
			did: this.did,
			rev: rev,
			now: now,
			writes: recordWrites,
			deletes: recordDeletes,
			validateBlobs: options.validateBlobs,
		});

		const commitEvent = {
			did: this.did,
			commitCid: commit.cid,
			rev: rev,
			since: prevRev,
			prevData: prevRootCid,
			now: now,
			ops: commitOps,
			blocks: commitBlocks,
		};

		if (options.emitSequencer !== false) {
			await this.sideEffects.sequencer.recordCommit(commitEvent);
		}

		return {
			commit: {
				cid: commit.cid,
				rev: rev,
			},
			commitEvent: commitEvent,
			results: results,
		};
	}

	private persistRepoRoot(cid: string, bytes: Uint8Array, rev: string): void {
		const content = Buffer.from(bytes);
		this.db
			.insert(t.repoRoot)
			.values({
				cid: cid,
				content: content,
				rev: rev,
			})
			.onConflictDoUpdate({
				target: t.repoRoot.id,
				set: {
					cid: cid,
					content: content,
					rev: rev,
				},
			})
			.run();
	}

	private persistRepoBlocks(blocks: Map<string, Uint8Array>, rev: string): void {
		if (blocks.size === 0) {
			return;
		}

		const rows = Array.from(blocks, ([cid, content]) => ({
			cid: cid,
			rev: rev,
			content: Buffer.from(content),
		}));

		for (const batch of chunked(rows, 50)) {
			this.db
				.insert(t.repoBlock)
				.values(batch)
				.onConflictDoNothing({
					target: t.repoBlock.cid,
				})
				.run();
		}
	}

	private async pruneRepoBlocks(
		nodeStore: NodeStore,
		prevRootCid: string | null,
		nextRootCid: string,
	): Promise<void> {
		if (!prevRootCid) {
			return;
		}

		const [created, deleted] = await mstDiff(nodeStore, prevRootCid, nextRootCid);
		const deleteCids = new Set<string>(deleted);

		for await (const delta of recordDiff(nodeStore, created, deleted)) {
			if (delta.deltaType === DeltaType.UPDATED || delta.deltaType === DeltaType.DELETED) {
				if (delta.priorValue) {
					deleteCids.add(delta.priorValue.$link);
				}
			}
		}

		if (deleteCids.size === 0) {
			return;
		}

		for (const batch of chunked(Array.from(deleteCids), 200)) {
			this.db.delete(t.repoBlock).where(inArray(t.repoBlock.cid, batch)).run();
		}
	}

	private async buildCommitBlocks(
		nodeStore: NodeStore,
		rootCid: string,
		commitCid: string,
		commitBytes: Uint8Array,
		mstBlocks: Map<string, Uint8Array>,
		recordBlocks: Map<string, Uint8Array>,
		recordDeletes: RepoRecordDelete[],
	): Promise<Map<string, Uint8Array>> {
		const blocks = new Map<string, Uint8Array>();

		blocks.set(commitCid, commitBytes);

		for (const [cid, bytes] of mstBlocks) {
			blocks.set(cid, bytes);
		}

		for (const [cid, bytes] of recordBlocks) {
			blocks.set(cid, bytes);
		}

		const proofCids = await this.collectDeletionProofs(nodeStore, rootCid, recordDeletes);
		for (const cid of proofCids) {
			if (blocks.has(cid)) {
				continue;
			}

			const node = await nodeStore.get(cid);
			blocks.set(cid, await node.serialize());
		}

		return blocks;
	}

	private async collectDeletionProofs(
		nodeStore: NodeStore,
		rootCid: string,
		recordDeletes: RepoRecordDelete[],
	): Promise<Set<string>> {
		const proofCids = new Set<string>();

		for (const record of recordDeletes) {
			const path: `${Nsid}/${RecordKey}` = `${record.collection}/${record.rkey}`;
			const proof = await buildExclusionProof(nodeStore, rootCid, path);
			for (const cid of proof) {
				proofCids.add(cid);
			}
		}

		return proofCids;
	}
}
