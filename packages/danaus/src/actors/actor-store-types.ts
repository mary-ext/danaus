import type { Did } from '@atcute/lexicons';

import type { BlobStore } from './blob-store/types';
import type { ActorDb } from './db';
import type { RepoSequencer } from './repo/side-effects';

/**
 * shared resources for actor store operations.
 */
export interface ActorStoreResources {
	createBlobStore: (did: Did) => BlobStore;
	sequencer: RepoSequencer;
}

/**
 * transactional database handle type for actor stores.
 */
export type ActorDbTransaction = Parameters<ActorDb['transaction']>[0] extends (tx: infer T) => unknown
	? T
	: ActorDb;

/**
 * actor database transaction.
 */
export type ActorDbConnection = ActorDbTransaction;
