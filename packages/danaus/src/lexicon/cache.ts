import { DocumentNotFoundError, type DidDocumentResolver } from '@atcute/identity-resolver';
import { findExternalReferences, type LexiconDoc } from '@atcute/lexicon-doc';
import { RecordValidator } from '@atcute/lexicon-doc/validations';
import {
	AuthorityNotFoundError,
	LexiconSchemaResolver,
	type LexiconAuthorityResolver,
} from '@atcute/lexicon-resolver';
import type { AtprotoDid, Nsid } from '@atcute/lexicons/syntax';

import { eq, lt } from 'drizzle-orm';
import PQueue from 'p-queue';

import type { BackgroundQueue } from '#app/background.ts';
import { lexiconCacheLogger } from '#app/logger.ts';
import { HOUR } from '#app/utils/times.ts';

import { getLexiconCacheDb, t, type LexiconCacheDb } from './db/index.ts';

const DEFAULT_STALE_TTL = HOUR;
const DEFAULT_MAX_TTL = 24 * HOUR;
const DEFAULT_PRUNE_INTERVAL = HOUR;

/** maximum depth when crawling lexicon references */
const DEFAULT_MAX_CRAWL_DEPTH = 10;
/** maximum number of schemas to load when resolving dependencies */
const DEFAULT_MAX_CRAWL_SCHEMAS = 50;

export interface LexiconCacheOptions {
	location: string;
	walAutoCheckpointDisabled: boolean;
	backgroundQueue: BackgroundQueue;
	authorityResolver: LexiconAuthorityResolver;
	didDocumentResolver: DidDocumentResolver;
	/** time before an entry is considered stale (default: 1 hour) */
	staleTtl?: number;
	/** time before an entry expires completely (default: 24 hours) */
	maxTtl?: number;
	/** interval between pruning runs (default: 1 hour) */
	pruneInterval?: number;
	/** whether lexicon resolution is enabled (default: true) */
	enabled?: boolean;
}

interface CachedAuthority {
	/** authority DID, or null if authority confirmed not to exist */
	did: AtprotoDid | null;
	updatedAt: number;
	stale: boolean;
	expired: boolean;
}

interface CachedSchema {
	/** schema document, or null for negative cache entry */
	doc: LexiconDoc | null;
	authorityDid: AtprotoDid;
	/** schema CID, or null for negative cache entry */
	cid: string | null;
	updatedAt: number;
	stale: boolean;
	expired: boolean;
}

/**
 * SQLite-backed lexicon cache for authority resolutions and schema documents.
 * supports stale-while-revalidate pattern with background refresh.
 */
export class LexiconCache implements Disposable {
	readonly #db: LexiconCacheDb;
	readonly #backgroundQueue: BackgroundQueue;
	readonly #authorityResolver: LexiconAuthorityResolver;
	readonly #schemaResolver: LexiconSchemaResolver;
	readonly #staleTtl: number;
	readonly #maxTtl: number;
	readonly #pruneInterval: Timer;
	readonly #enabled: boolean;

	/** p-queue for limiting concurrent network fetches */
	readonly #fetchQueue = new PQueue({ concurrency: 4 });

	/** in-flight authority resolution promises for request coalescing */
	readonly #inflightAuthority = new Map<string, Promise<AtprotoDid | null>>();

	/** in-flight schema resolution promises for request coalescing */
	readonly #inflightSchema = new Map<Nsid, Promise<LexiconDoc | null>>();

	constructor(options: LexiconCacheOptions) {
		this.#db = getLexiconCacheDb(options.location, options.walAutoCheckpointDisabled);
		this.#backgroundQueue = options.backgroundQueue;
		this.#authorityResolver = options.authorityResolver;
		this.#schemaResolver = new LexiconSchemaResolver({
			didDocumentResolver: options.didDocumentResolver,
		});
		this.#staleTtl = options.staleTtl ?? DEFAULT_STALE_TTL;
		this.#maxTtl = options.maxTtl ?? DEFAULT_MAX_TTL;
		this.#enabled = options.enabled ?? true;

		const pruneIntervalMs = options.pruneInterval ?? DEFAULT_PRUNE_INTERVAL;
		this.#pruneInterval = setInterval(() => {
			this.#backgroundQueue.add(() => this.pruneExpired());
		}, pruneIntervalMs);
	}

	/** whether lexicon resolution is enabled */
	get enabled(): boolean {
		return this.#enabled;
	}

	// #region authority resolution

	/**
	 * get NSID domain from an NSID (e.g., "app.bsky.feed.post" -> "app.bsky").
	 */
	#getNsidDomain(nsid: Nsid): string {
		// NSID format: domain segments in reverse order, then name segment(s)
		// e.g., "app.bsky.feed.post" -> authority is "app.bsky"
		// the authority is determined by the first two segments
		const parts = nsid.split('.');
		if (parts.length < 3) {
			return nsid;
		}
		return parts.slice(0, 2).join('.');
	}

	/**
	 * get cached authority resolution for an NSID domain.
	 */
	#getCachedAuthority(domain: string): CachedAuthority | null {
		const row = this.#db.select().from(t.authority).where(eq(t.authority.domain, domain)).get();

		if (!row) {
			return null;
		}

		const now = Date.now();
		const updatedAt = row.updated_at.getTime();
		return {
			did: row.did,
			updatedAt: updatedAt,
			stale: now > updatedAt + this.#staleTtl,
			expired: now > updatedAt + this.#maxTtl,
		};
	}

	/**
	 * cache an authority resolution.
	 * @param domain NSID domain (e.g., "app.bsky")
	 * @param did authority DID, or null to cache a negative result
	 * @internal exposed as `_setAuthority` for test injection
	 */
	_setAuthority(domain: string, did: AtprotoDid | null): void {
		const now = new Date();
		this.#db
			.insert(t.authority)
			.values({ domain, did, updated_at: now })
			.onConflictDoUpdate({
				target: t.authority.domain,
				set: { did, updated_at: now },
			})
			.run();
	}

	/**
	 * resolve the authority DID for an NSID.
	 * @param nsid NSID to resolve authority for
	 * @returns authority DID or null if resolution fails or authority doesn't exist
	 */
	async resolveAuthority(nsid: Nsid): Promise<AtprotoDid | null> {
		if (!this.#enabled) {
			return null;
		}

		const domain = this.#getNsidDomain(nsid);

		// check cache first (includes negative cache entries)
		const cached = this.#getCachedAuthority(domain);
		if (cached && !cached.expired) {
			if (cached.stale && cached.did !== null) {
				// only refresh in background for positive results
				this.#refreshAuthorityInBackground(nsid);
			}
			return cached.did;
		}

		// coalesce concurrent requests
		const existing = this.#inflightAuthority.get(domain);
		if (existing) {
			return existing;
		}

		// queue the fetch
		const promise = this.#fetchQueue.add(async () => {
			try {
				const did = await this.#authorityResolver.resolve(nsid);
				this._setAuthority(domain, did);
				return did;
			} catch (err) {
				// cache negative result for AuthorityNotFoundError (definitive "no authority")
				if (err instanceof AuthorityNotFoundError) {
					lexiconCacheLogger.debug('caching negative authority result', { nsid, domain });
					this._setAuthority(domain, null);
					return null;
				}

				// don't cache transient errors
				lexiconCacheLogger.warn('failed to resolve lexicon authority', { nsid, err });
				return null;
			}
		});

		this.#inflightAuthority.set(domain, promise);

		try {
			return await promise;
		} finally {
			this.#inflightAuthority.delete(domain);
		}
	}

	/**
	 * queue a background refresh for an authority resolution.
	 */
	#refreshAuthorityInBackground(nsid: Nsid): void {
		const domain = this.#getNsidDomain(nsid);

		this.#backgroundQueue.add(async () => {
			try {
				const did = await this.#authorityResolver.resolve(nsid);
				this._setAuthority(domain, did);
			} catch (err) {
				lexiconCacheLogger.warn('background authority refresh failed', { nsid, err });
			}
		});
	}

	// #endregion

	// #region schema resolution

	/**
	 * get cached schema for an NSID.
	 */
	#getCachedSchema(nsid: Nsid): CachedSchema | null {
		const row = this.#db.select().from(t.schema).where(eq(t.schema.nsid, nsid)).get();

		if (!row) {
			return null;
		}

		const now = Date.now();
		const updatedAt = row.updated_at.getTime();
		return {
			doc: row.doc,
			authorityDid: row.authority_did,
			cid: row.cid,
			updatedAt: updatedAt,
			stale: now > updatedAt + this.#staleTtl,
			expired: now > updatedAt + this.#maxTtl,
		};
	}

	/**
	 * cache a schema document.
	 * @param nsid NSID of the schema
	 * @param authorityDid authority DID that was used
	 * @param cid schema CID, or null for negative cache entry
	 * @param doc schema document, or null for negative cache entry
	 * @internal exposed as `_setSchema` for test injection
	 */
	_setSchema(nsid: Nsid, authorityDid: AtprotoDid, cid: string | null, doc: LexiconDoc | null): void {
		const now = new Date();
		this.#db
			.insert(t.schema)
			.values({
				nsid,
				authority_did: authorityDid,
				cid,
				doc,
				updated_at: now,
			})
			.onConflictDoUpdate({
				target: t.schema.nsid,
				set: {
					authority_did: authorityDid,
					cid,
					doc,
					updated_at: now,
				},
			})
			.run();
	}

	/**
	 * get a lexicon schema document.
	 * @param nsid NSID to fetch schema for
	 * @returns lexicon document or null if not found/resolution fails
	 */
	async getSchema(nsid: Nsid): Promise<LexiconDoc | null> {
		if (!this.#enabled) {
			return null;
		}

		// resolve authority first to check for authority changes
		const authorityDid = await this.resolveAuthority(nsid);
		if (!authorityDid) {
			return null;
		}

		// check cache - invalidate if authority has changed
		const cached = this.#getCachedSchema(nsid);
		if (cached && !cached.expired) {
			// if authority changed, bust the cache and refetch
			if (cached.authorityDid !== authorityDid) {
				lexiconCacheLogger.debug('authority changed, invalidating schema cache', {
					nsid,
					oldAuthority: cached.authorityDid,
					newAuthority: authorityDid,
				});
				// don't return cached, fall through to refetch
			} else {
				if (cached.stale && cached.doc !== null) {
					// only refresh in background for positive results
					this.#refreshSchemaInBackground(nsid, cached.authorityDid);
				}
				return cached.doc;
			}
		}

		// coalesce concurrent requests
		const existing = this.#inflightSchema.get(nsid);
		if (existing) {
			const result = await existing;
			return result;
		}

		// queue the fetch
		const promise = this.#fetchQueue.add(async () => {
			try {
				const resolved = await this.#schemaResolver.resolve(authorityDid, nsid);
				this._setSchema(nsid, authorityDid, resolved.cid, resolved.schema);
				return resolved.schema;
			} catch (err) {
				// cache negative result for definitive "schema doesn't exist" errors
				if (err instanceof DocumentNotFoundError) {
					lexiconCacheLogger.debug('caching negative schema result', { nsid, authorityDid });
					this._setSchema(nsid, authorityDid, null, null);
					return null;
				}

				// don't cache transient errors (network failures, etc.)
				lexiconCacheLogger.warn('failed to resolve lexicon schema', { nsid, authorityDid, err });
				return null;
			}
		});

		this.#inflightSchema.set(nsid, promise);

		try {
			const result = await promise;
			return result;
		} finally {
			this.#inflightSchema.delete(nsid);
		}
	}

	/**
	 * queue a background refresh for a schema.
	 */
	#refreshSchemaInBackground(nsid: Nsid, authorityDid: AtprotoDid): void {
		this.#backgroundQueue.add(async () => {
			try {
				const resolved = await this.#schemaResolver.resolve(authorityDid, nsid);
				this._setSchema(nsid, authorityDid, resolved.cid, resolved.schema);
			} catch (err) {
				lexiconCacheLogger.warn('background schema refresh failed', { nsid, err });
			}
		});
	}

	// #endregion

	// #region dependency resolution

	/**
	 * get all schema documents needed for validating a record type.
	 * recursively resolves all external references with depth and total limits.
	 * @param nsid NSID of the record type
	 * @returns map of NSID -> LexiconDoc, or null if any required schema can't be resolved
	 */
	async getRecordDocs(nsid: Nsid): Promise<Record<string, LexiconDoc> | null> {
		if (!this.#enabled) {
			return null;
		}

		const docs: Record<string, LexiconDoc> = {};
		const visited = new Set<string>();
		let count = 0;

		// start with the main reference
		for await (const result of this.#crawlReferences(`${nsid}#main`, visited, 0)) {
			// null indicates a required schema couldn't be resolved or limits exceeded
			if (result === null) {
				return null;
			}

			// check total schemas limit
			if (count >= DEFAULT_MAX_CRAWL_SCHEMAS) {
				return null;
			}

			docs[result.nsid] = result.schema;
			count++;
		}

		return docs;
	}

	/**
	 * recursively crawl all transitive dependencies for a given reference.
	 * yields null if a required schema can't be resolved or limits are exceeded.
	 * @param ref reference to crawl (e.g., "app.bsky.feed.post#main")
	 * @param visited set of already-visited references (for cycle detection)
	 * @param depth current recursion depth
	 */
	async *#crawlReferences(
		ref: string,
		visited: Set<string>,
		depth: number,
	): AsyncGenerator<{ nsid: Nsid; schema: LexiconDoc } | null> {
		// check depth limit
		if (depth > DEFAULT_MAX_CRAWL_DEPTH) {
			yield null;
			return;
		}

		// normalize ref to include #defId
		if (!ref.includes('#')) {
			ref = `${ref}#main`;
		}

		// cycle detection
		if (visited.has(ref)) {
			return;
		}
		visited.add(ref);

		// parse the reference
		const hashIndex = ref.indexOf('#');
		// oxlint-disable-next-line no-unsafe-type-assertion -- branded type from parsed reference
		const nsid = ref.slice(0, hashIndex) as Nsid;
		const defId = ref.slice(hashIndex + 1);

		// try to load the schema
		const schema = await this.getSchema(nsid);
		if (schema === null) {
			yield null;
			return;
		}

		yield { nsid, schema };

		// find external references in the specific definition
		const externalRefs = findExternalReferences(schema, defId);

		// recursively crawl each external reference
		for (const externalRef of externalRefs) {
			yield* this.#crawlReferences(externalRef, visited, depth + 1);
		}
	}

	// #endregion

	// #region validation

	/**
	 * create a RecordValidator for a record type.
	 * @param nsid NSID of the record type
	 * @returns RecordValidator or null if schemas can't be resolved
	 */
	async getRecordValidator(nsid: Nsid): Promise<RecordValidator | null> {
		if (!this.#enabled) {
			return null;
		}

		const docs = await this.getRecordDocs(nsid);
		if (!docs) {
			return null;
		}

		return new RecordValidator(docs, nsid);
	}

	// #endregion

	// #region maintenance

	/**
	 * remove all expired entries from the cache.
	 */
	async pruneExpired(): Promise<void> {
		const cutoff = new Date(Date.now() - this.#maxTtl);
		this.#db.delete(t.authority).where(lt(t.authority.updated_at, cutoff)).run();
		this.#db.delete(t.schema).where(lt(t.schema.updated_at, cutoff)).run();
	}

	/**
	 * clear all cached entries.
	 */
	clear(): void {
		this.#db.delete(t.authority).run();
		this.#db.delete(t.schema).run();
	}

	dispose(): void {
		clearInterval(this.#pruneInterval);
		this.#db.$client.close();
	}

	[Symbol.dispose](): void {
		this.dispose();
	}

	// #endregion
}
