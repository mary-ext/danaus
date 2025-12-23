import type { ComAtprotoSyncSubscribeRepos } from '@atcute/atproto';
import type { $type } from '@atcute/lexicons';

export type RepoSeqEventType = 'commit' | 'sync' | 'identity' | 'account';

export type CommitEvt = Omit<ComAtprotoSyncSubscribeRepos.Commit, 'seq' | 'time'>;
export type SyncEvt = Omit<ComAtprotoSyncSubscribeRepos.Sync, 'seq' | 'time'>;
export type IdentityEvt = Omit<ComAtprotoSyncSubscribeRepos.Identity, 'seq' | 'time'>;
export type AccountEvt = Omit<ComAtprotoSyncSubscribeRepos.Account, 'seq' | 'time'>;

export type StoredCommit = $type.enforce<Omit<CommitEvt, 'blocks'> & { blocks: null }>;
export type StoredSync = $type.enforce<Omit<SyncEvt, 'blocks'> & { blocks: null }>;
export type StoredIdentity = $type.enforce<IdentityEvt>;
export type StoredAccount = $type.enforce<AccountEvt>;

export type StoredMessage = StoredAccount | StoredIdentity | StoredCommit | StoredSync;

export type SeqEvt =
	| {
			type: 'commit';
			seq: number;
			time: string;
			evt: CommitEvt;
	  }
	| {
			type: 'sync';
			seq: number;
			time: string;
			evt: SyncEvt;
	  }
	| {
			type: 'identity';
			seq: number;
			time: string;
			evt: IdentityEvt;
	  }
	| {
			type: 'account';
			seq: number;
			time: string;
			evt: AccountEvt;
	  };
