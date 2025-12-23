import type { CanonicalResourceUri, Nsid, RecordKey } from '@atcute/lexicons';
import type { Commit } from '@atcute/repo';

import type { RepoCommitEvent } from './side-effects';

export type RepoWriteAction = 'create' | 'update' | 'delete';

export interface RepoWriteOpBase {
	action: RepoWriteAction;
	collection: Nsid;
	rkey?: RecordKey;
	swapRecord?: string | null;
}

export interface RepoWriteOpCreate extends RepoWriteOpBase {
	action: 'create';
	record: unknown;
}

export interface RepoWriteOpUpdate extends RepoWriteOpBase {
	action: 'update';
	record: unknown;
}

export interface RepoWriteOpDelete extends RepoWriteOpBase {
	action: 'delete';
}

export type RepoWriteOp = RepoWriteOpCreate | RepoWriteOpUpdate | RepoWriteOpDelete;

export interface RepoRoot {
	cid: string;
	rev: string;
	commit: Commit;
	bytes: Uint8Array;
}

export interface RepoRecordEntry {
	uri: CanonicalResourceUri;
	cid: string;
	record: unknown;
}

export interface RepoRecordInfo {
	uri: CanonicalResourceUri;
	cid: string;
}

export interface ListRecordsOptions {
	limit?: number;
	cursor?: RecordKey;
	reverse?: boolean;
	includeRecords?: boolean;
}

export interface ApplyWritesResult {
	commit: {
		cid: string;
		rev: string;
	};
	commitEvent: RepoCommitEvent;
	results: RepoWriteResult[];
}

export interface RepoWriteResult {
	action: RepoWriteAction;
	uri: CanonicalResourceUri;
	cid: string | null;
}

export interface ApplyWritesOptions {
	swapCommit?: string | null;
	validateBlobs?: boolean;
	emitSequencer?: boolean;
}
