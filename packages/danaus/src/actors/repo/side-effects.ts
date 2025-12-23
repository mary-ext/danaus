import type { CanonicalResourceUri, Did, Nsid, RecordKey } from '@atcute/lexicons';

import type { RecordIndexUpsert } from '../record/types';

import type { RepoWriteResult } from './types';

type MaybePromise<T> = T | PromiseLike<T>;

export interface RepoRecordWrite {
	action: 'create' | 'update';
	uri: CanonicalResourceUri;
	collection: Nsid;
	rkey: RecordKey;
	cid: string;
	record: unknown;
}

export interface RepoRecordDelete {
	uri: CanonicalResourceUri;
	collection: Nsid;
	rkey: RecordKey;
}

export interface RepoBlobWriteOptions {
	did: Did;
	rev: string;
	now: Date;
	writes: RepoRecordWrite[];
	deletes: RepoRecordDelete[];
	validateBlobs?: boolean;
}

export interface RepoCommitEvent {
	did: Did;
	commitCid: string;
	rev: string;
	since: string | null;
	prevData: string | null;
	now: Date;
	ops: RepoCommitOp[];
	blocks: Map<string, Uint8Array>;
}

export interface RepoCommitOp {
	action: RepoWriteResult['action'];
	path: `${Nsid}/${RecordKey}`;
	cid: string | null;
	prev?: string | null;
}

export interface RepoRecordIndexer {
	/**
	 * upsert record index entries.
	 * @param records record index entries
	 */
	upsertRecords(records: RecordIndexUpsert[]): MaybePromise<void>;
	/**
	 * delete record index entries.
	 * @param uris record uris to delete
	 */
	deleteRecords(uris: CanonicalResourceUri[]): MaybePromise<void>;
}

export interface RepoSequencer {
	/**
	 * record a repo commit event.
	 * @param event commit event
	 */
	recordCommit(event: RepoCommitEvent): MaybePromise<void>;
}

export interface RepoBlobHandler {
	/**
	 * apply blob updates after persisting the commit.
	 * @param options blob update options
	 */
	applyWrites(options: RepoBlobWriteOptions): MaybePromise<void>;
}

export interface RepoSideEffects {
	recordIndexer: RepoRecordIndexer;
	sequencer: RepoSequencer;
	blobHandler: RepoBlobHandler;
}

/**
 * create a no-op record indexer.
 * @returns no-op record indexer
 */
export const createNoopRepoRecordIndexer = (): RepoRecordIndexer => {
	return {
		upsertRecords() {},
		deleteRecords() {},
	};
};

/**
 * create a no-op repo sequencer.
 * @returns no-op repo sequencer
 */
export const createNoopRepoSequencer = (): RepoSequencer => {
	return {
		recordCommit() {},
	};
};

/**
 * create a no-op blob handler.
 * @returns no-op blob handler
 */
export const createNoopRepoBlobHandler = (): RepoBlobHandler => {
	return {
		applyWrites() {},
	};
};
