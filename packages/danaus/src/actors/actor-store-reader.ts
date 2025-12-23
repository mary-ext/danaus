import type { PrivateKey } from '@atcute/crypto';
import type { Did } from '@atcute/lexicons';

import { ActorStoreTransactor } from './actor-store-transactor';
import type { ActorDbTransaction, ActorStoreResources } from './actor-store-types';
import type { BlobStore } from './blob-store/types';
import { BlobReader } from './blobs/reader';
import { PreferenceReader } from './preferences/reader';
import { RecordReader } from './record/reader';
import { RepoReader } from './repo/reader';

/**
 * read-only actor store context
 */
export class ActorStoreReader {
	/** actor did */
	readonly did: Did;
	/** actor database transaction */
	readonly db: ActorDbTransaction;
	/** actor blob store */
	readonly blobStore: BlobStore;
	/** actor store resources. */
	readonly resources: ActorStoreResources;
	/** repo reader helper */
	readonly repo: RepoReader;
	/** record reader helper */
	readonly record: RecordReader;
	/** blob reader helper */
	readonly blob: BlobReader;
	/** preference reader helper */
	readonly pref: PreferenceReader;

	private readonly _keypair: () => Promise<PrivateKey>;

	/**
	 * create a read context.
	 * @param did actor did
	 * @param db actor database transaction
	 * @param resources store resources
	 * @param keypair repo signing key accessor
	 */
	constructor(
		did: Did,
		db: ActorDbTransaction,
		resources: ActorStoreResources,
		keypair: () => Promise<PrivateKey>,
	) {
		this.did = did;
		this.db = db;
		this.resources = resources;
		this.blobStore = resources.createBlobStore(did);
		this.repo = new RepoReader(db, this.blobStore);
		this.record = new RecordReader(db);
		this.blob = new BlobReader(db, this.blobStore);
		this.pref = new PreferenceReader(db);

		let keypairPromise: Promise<PrivateKey> | undefined;
		this._keypair = () => (keypairPromise ??= Promise.resolve().then(keypair));
	}

	/**
	 * lazily load the repo signing key.
	 * @returns repo signing key
	 */
	keypair(): Promise<PrivateKey> {
		return this._keypair();
	}

	/**
	 * create a write-capable store within this read context.
	 * @returns write-capable store
	 */
	async writer(): Promise<ActorStoreTransactor> {
		const keypair = await this.keypair();
		return new ActorStoreTransactor(this.did, this.db, keypair, this.resources);
	}
}
