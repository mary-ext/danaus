import type { DidDocument } from '@atcute/identity';
import type { AtprotoDid, Handle } from '@atcute/lexicons/syntax';

import { eq, lt } from 'drizzle-orm';

import type { BackgroundQueue } from '#app/background.ts';
import { didCacheLogger } from '#app/logger.ts';
import { HOUR } from '#app/utils/times.ts';

import { getIdentityCacheDb, t, type IdentityCacheDb } from './db/index.ts';

const DEFAULT_STALE_TTL = HOUR;
const DEFAULT_MAX_TTL = 24 * HOUR;
const DEFAULT_PRUNE_INTERVAL = HOUR;

export interface IdentityCacheOptions {
	location: string;
	walAutoCheckpointDisabled: boolean;
	backgroundQueue: BackgroundQueue;
	/** time before an entry is considered stale (default: 1 hour) */
	staleTtl?: number;
	/** time before an entry expires completely (default: 24 hours) */
	maxTtl?: number;
	/** interval between pruning runs (default: 1 hour) */
	pruneInterval?: number;
}

export interface CacheResult<T> {
	value: T;
	updatedAt: number;
	stale: boolean;
	expired: boolean;
}

/**
 * SQLite-backed identity cache for handles and DID documents.
 * supports stale-while-revalidate pattern with background refresh.
 */
export class IdentityCache implements Disposable {
	readonly #db: IdentityCacheDb;
	readonly #backgroundQueue: BackgroundQueue;
	readonly #staleTtl: number;
	readonly #maxTtl: number;
	readonly #pruneInterval: Timer;

	constructor(options: IdentityCacheOptions) {
		this.#db = getIdentityCacheDb(options.location, options.walAutoCheckpointDisabled);
		this.#backgroundQueue = options.backgroundQueue;
		this.#staleTtl = options.staleTtl ?? DEFAULT_STALE_TTL;
		this.#maxTtl = options.maxTtl ?? DEFAULT_MAX_TTL;

		const pruneIntervalMs = options.pruneInterval ?? DEFAULT_PRUNE_INTERVAL;
		this.#pruneInterval = setInterval(() => {
			this.#backgroundQueue.add(() => this.pruneExpired());
		}, pruneIntervalMs);
	}

	// #region handles

	/**
	 * get a cached handle resolution.
	 * @param handle handle to look up
	 * @returns cache result or null if not found
	 */
	getHandle(handle: Handle): CacheResult<AtprotoDid> | null {
		const row = this.#db.select().from(t.handle).where(eq(t.handle.handle, handle)).get();

		if (!row) {
			return null;
		}

		const now = Date.now();
		return {
			value: row.did,
			updatedAt: row.updated_at,
			stale: now > row.updated_at + this.#staleTtl,
			expired: now > row.updated_at + this.#maxTtl,
		};
	}

	/**
	 * cache a handle resolution.
	 * @param handle handle
	 * @param did resolved DID
	 */
	setHandle(handle: Handle, did: AtprotoDid): void {
		this.#db
			.insert(t.handle)
			.values({ handle, did, updated_at: Date.now() })
			.onConflictDoUpdate({
				target: t.handle.handle,
				set: { did, updated_at: Date.now() },
			})
			.run();
	}

	/**
	 * remove a handle from cache.
	 * @param handle handle to remove
	 */
	clearHandle(handle: Handle): void {
		this.#db.delete(t.handle).where(eq(t.handle.handle, handle)).run();
	}

	/**
	 * queue a background refresh for a handle.
	 * @param handle handle to refresh
	 * @param resolve function to resolve the handle
	 */
	refreshHandle(handle: Handle, resolve: () => Promise<AtprotoDid | null>): void {
		this.#backgroundQueue.add(async () => {
			try {
				const did = await resolve();
				if (did) {
					this.setHandle(handle, did);
				} else {
					this.clearHandle(handle);
				}
			} catch (err) {
				didCacheLogger.error('refreshing handle cache failed', { handle, err });
			}
		});
	}

	// #endregion

	// #region DID documents

	/**
	 * get a cached DID document.
	 * @param did DID to look up
	 * @returns cache result or null if not found
	 */
	getDidDoc(did: AtprotoDid): CacheResult<DidDocument> | null {
		const row = this.#db.select().from(t.didDoc).where(eq(t.didDoc.did, did)).get();

		if (!row) {
			return null;
		}

		const now = Date.now();
		return {
			value: row.doc,
			updatedAt: row.updated_at,
			stale: now > row.updated_at + this.#staleTtl,
			expired: now > row.updated_at + this.#maxTtl,
		};
	}

	/**
	 * cache a DID document.
	 * @param did DID
	 * @param doc DID document
	 */
	setDidDoc(did: AtprotoDid, doc: DidDocument): void {
		this.#db
			.insert(t.didDoc)
			.values({ did, doc, updated_at: Date.now() })
			.onConflictDoUpdate({
				target: t.didDoc.did,
				set: { doc, updated_at: Date.now() },
			})
			.run();
	}

	/**
	 * remove a DID document from cache.
	 * @param did DID to remove
	 */
	clearDidDoc(did: AtprotoDid): void {
		this.#db.delete(t.didDoc).where(eq(t.didDoc.did, did)).run();
	}

	/**
	 * queue a background refresh for a DID document.
	 * @param did DID to refresh
	 * @param resolve function to resolve the DID document
	 */
	refreshDidDoc(did: AtprotoDid, resolve: () => Promise<DidDocument | null>): void {
		this.#backgroundQueue.add(async () => {
			try {
				const doc = await resolve();
				if (doc) {
					this.setDidDoc(did, doc);
				} else {
					this.clearDidDoc(did);
				}
			} catch (err) {
				didCacheLogger.error('refreshing did cache failed', { did, err });
			}
		});
	}

	// #endregion

	/**
	 * remove all expired entries from the cache.
	 */
	async pruneExpired(): Promise<void> {
		const cutoff = Date.now() - this.#maxTtl;
		this.#db.delete(t.handle).where(lt(t.handle.updated_at, cutoff)).run();
		this.#db.delete(t.didDoc).where(lt(t.didDoc.updated_at, cutoff)).run();
	}

	/**
	 * clear all cached entries.
	 */
	clear(): void {
		this.#db.delete(t.handle).run();
		this.#db.delete(t.didDoc).run();
	}

	dispose(): void {
		clearInterval(this.#pruneInterval);
		this.#db.$client.close();
	}

	[Symbol.dispose](): void {
		this.dispose();
	}
}
