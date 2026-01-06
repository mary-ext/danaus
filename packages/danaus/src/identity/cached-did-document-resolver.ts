import type { DidDocument } from '@atcute/identity';
import type { DidDocumentResolver, ResolveDidDocumentOptions } from '@atcute/identity-resolver';
import type { Did } from '@atcute/lexicons/syntax';

import type { IdentityCache } from './manager.ts';

type AtprotoDidMethod = 'plc' | 'web';

export interface CachedDidDocumentResolverOptions {
	cache: IdentityCache;
	resolver: DidDocumentResolver<AtprotoDidMethod>;
}

/**
 * DID document resolver wrapper that adds caching with stale-while-revalidate.
 */
export class CachedDidDocumentResolver implements DidDocumentResolver<AtprotoDidMethod> {
	readonly #cache: IdentityCache;
	readonly #resolver: DidDocumentResolver<AtprotoDidMethod>;

	constructor(options: CachedDidDocumentResolverOptions) {
		this.#cache = options.cache;
		this.#resolver = options.resolver;
	}

	async resolve(did: Did<AtprotoDidMethod>, options?: ResolveDidDocumentOptions): Promise<DidDocument> {
		// bypass cache if requested
		if (options?.noCache) {
			const doc = await this.#resolver.resolve(did, options);
			this.#cache.setDidDoc(did, doc);
			return doc;
		}

		// check cache
		const cached = this.#cache.getDidDoc(did);

		if (cached && !cached.expired) {
			// trigger background refresh if stale
			if (cached.stale) {
				this.#cache.refreshDidDoc(did, () => this.resolveNoThrow(did));
			}
			return cached.value;
		}

		// cache miss or expired - fetch fresh
		const doc = await this.#resolver.resolve(did, options);
		this.#cache.setDidDoc(did, doc);
		return doc;
	}

	private async resolveNoThrow(
		did: Did<AtprotoDidMethod>,
		options?: ResolveDidDocumentOptions,
	): Promise<DidDocument | null> {
		try {
			return await this.#resolver.resolve(did, options);
		} catch {
			return null;
		}
	}
}
