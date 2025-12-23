import type { PrivateKey } from '@atcute/crypto';
import type { Did } from '@atcute/lexicons';

import type { ActorDbConnection, ActorStoreResources } from './actor-store-types';
import type { BlobStore } from './blob-store/types';
import { BlobTransactor } from './blobs/transactor';
import { PreferenceTransactor } from './preferences/transactor';
import { RecordTransactor } from './record/transactor';
import { RepoTransactor } from './repo/transactor';

/**
 * write-capable actor store context.
 */
export class ActorStoreTransactor {
	/** actor did. */
	readonly did: Did;
	/** actor database transaction. */
	readonly db: ActorDbConnection;
	/** actor blob store. */
	readonly blobStore: BlobStore;
	/** repo signing key. */
	readonly keypair: PrivateKey;
	/** actor store resources. */
	readonly resources: ActorStoreResources;
	/** repo writer helper. */
	readonly repo: RepoTransactor;
	/** blob metadata helper. */
	readonly blob: BlobTransactor;
	/** record writer helper. */
	readonly record: RecordTransactor;
	/** preference writer helper. */
	readonly pref: PreferenceTransactor;

	/**
	 * create a write-capable actor store context.
	 * @param did actor did
	 * @param db actor database transaction
	 * @param keypair repo signing key
	 * @param resources store resources
	 */
	constructor(did: Did, db: ActorDbConnection, keypair: PrivateKey, resources: ActorStoreResources) {
		this.did = did;
		this.db = db;
		this.keypair = keypair;
		this.resources = resources;
		this.blobStore = resources.createBlobStore(did);
		this.record = new RecordTransactor(this.db);
		this.blob = new BlobTransactor(this.db, this.blobStore);
		this.pref = new PreferenceTransactor(this.db);

		const sideEffects = {
			recordIndexer: this.record,
			sequencer: resources.sequencer,
			blobHandler: this.blob,
		};

		this.repo = new RepoTransactor(this.db, this.blobStore, did, keypair, sideEffects);
	}
}
