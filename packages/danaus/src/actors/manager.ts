import { mkdir, rm } from 'node:fs/promises';
import * as path from 'node:path';

import { Secp256k1PrivateKey, type PrivateKey, type PrivateKeyExportable } from '@atcute/crypto';
import type { Did } from '@atcute/lexicons';
import { InvalidRequestError } from '@atcute/xrpc-server';

import type { ActorStoreConfig } from '#app/config.ts';

import { ActorStoreReader } from './actor-store-reader';
import { ActorStoreTransactor } from './actor-store-transactor';
import type { ActorStoreResources } from './actor-store-types';
import { DiskBlobStore } from './blob-store/disk';
import { getActorDb, type ActorDb } from './db';

/**
 * filesystem locations for an actor store.
 */
export interface ActorLocation {
	directory: string;
	dbLocation: string;
	keyLocation: string;
}

/**
 * disposable actor database handle.
 */
export interface ActorDbHandle extends Disposable {
	db: ActorDb;
}

/**
 * actor store manager for filesystem and database access.
 */
export class ActorManager {
	readonly config: ActorStoreConfig;
	readonly resources: ActorStoreResources;

	constructor(config: ActorStoreConfig, resources: ActorStoreResources) {
		this.config = config;
		this.resources = resources;
	}

	/**
	 * resolve on-disk locations for an actor store.
	 * @param did actor did
	 * @returns actor store locations
	 */
	getLocation(did: Did): ActorLocation {
		const directory = path.join(this.config.directory, did);
		const dbLocation = path.join(directory, `store.db`);
		const keyLocation = path.join(directory, `key`);

		return { directory, dbLocation, keyLocation };
	}

	/**
	 * check whether an actor store exists.
	 * @param did actor did
	 * @returns true when the store database exists
	 */
	async exists(did: Did): Promise<boolean> {
		const { dbLocation } = this.getLocation(did);
		const file = Bun.file(dbLocation);

		return await file.exists();
	}

	/**
	 * load the repo signing key for an actor.
	 * @param did actor did
	 * @returns private key
	 */
	async importKeypair(did: Did): Promise<PrivateKey> {
		const { keyLocation } = this.getLocation(did);

		const raw = await Bun.file(keyLocation).bytes();
		const key = await Secp256k1PrivateKey.importRaw(raw);

		return key;
	}

	/**
	 * open an actor database handle.
	 * @param did actor did
	 * @returns database handle
	 */
	async openDb(did: Did): Promise<ActorDbHandle> {
		const { dbLocation } = this.getLocation(did);

		const exists = await Bun.file(dbLocation).exists();
		if (!exists) {
			throw new InvalidRequestError({ error: 'RepoNotFound', description: `repository not found` });
		}

		const db = getActorDb(dbLocation, this.config.walAutoCheckpointDisabled);

		return {
			db: db,
			[Symbol.dispose]() {
				db.$client.close();
			},
		};
	}

	/**
	 * create a new actor store and persist a signing key.
	 * @param did actor did
	 * @param keypair exportable private key
	 */
	async create(did: Did, keypair: PrivateKeyExportable): Promise<void> {
		const { directory, dbLocation, keyLocation } = this.getLocation(did);

		await mkdir(directory, { recursive: true });

		const dbExists = await Bun.file(dbLocation).exists();
		if (dbExists) {
			throw new InvalidRequestError({ error: 'RepoAlreadyExists', description: `repository already exists` });
		}

		const rawKey = await keypair.exportPrivateKey('raw');
		await Bun.file(keyLocation).write(rawKey);

		const db = getActorDb(dbLocation, this.config.walAutoCheckpointDisabled);
		db.$client.close();
	}

	async destroy(did: Did): Promise<void> {
		const { directory } = this.getLocation(did);
		const blobStore = this.resources.createBlobStore(did);

		if (blobStore instanceof DiskBlobStore) {
			await blobStore.deleteAll();
		} else {
			await this.read(did, async (store) => {
				let cursor: string | undefined;
				do {
					const result = store.blob.listBlobs({ limit: 250, cursor });
					cursor = result.at(-1);

					// oxlint-disable-next-line no-await-in-loop -- paginated deletion
					await blobStore.deleteMany(result);
				} while (cursor !== undefined);
			});
		}

		await rm(directory, { recursive: true, force: true });
	}

	/**
	 * open a read-only actor store context.
	 * @param did actor did
	 * @param fn callback executed with a read context
	 * @returns callback result
	 */
	async read<T>(did: Did, fn: (store: ActorStoreReader) => T | PromiseLike<T>): Promise<T> {
		using handle = await this.openDb(did);
		const keypair = () => this.importKeypair(did);
		return await handle.db.transaction(
			(tx) => {
				return fn(new ActorStoreReader(did, tx, this.resources, keypair));
			},
			{ behavior: 'deferred' },
		);
	}

	/**
	 * open a transactional actor store context.
	 * @param did actor did
	 * @param fn callback executed within a database transaction
	 * @returns callback result
	 */
	async transact<T>(did: Did, fn: (store: ActorStoreTransactor) => T | PromiseLike<T>): Promise<T> {
		using handle = await this.openDb(did);
		const keypair = await this.importKeypair(did);
		return await handle.db.transaction(
			(tx) => {
				return fn(new ActorStoreTransactor(did, tx, keypair, this.resources));
			},
			{ behavior: 'immediate' },
		);
	}
}
