import type { HandleResolver, ResolveHandleOptions } from '@atcute/identity-resolver';
import type { AtprotoDid, Handle } from '@atcute/lexicons/syntax';

import type { IdentityCache } from './manager.ts';

export interface CachedHandleResolverOptions {
	cache: IdentityCache;
	resolver: HandleResolver;
}

/**
 * handle resolver wrapper that adds caching with stale-while-revalidate.
 */
export class CachedHandleResolver implements HandleResolver {
	readonly #cache: IdentityCache;
	readonly #resolver: HandleResolver;

	constructor(options: CachedHandleResolverOptions) {
		this.#cache = options.cache;
		this.#resolver = options.resolver;
	}

	async resolve(handle: Handle, options?: ResolveHandleOptions): Promise<AtprotoDid> {
		// bypass cache if requested
		if (options?.noCache) {
			const did = await this.#resolver.resolve(handle, options);
			this.#cache.setHandle(handle, did);
			return did;
		}

		// check cache
		const cached = this.#cache.getHandle(handle);

		if (cached && !cached.expired) {
			// trigger background refresh if stale
			if (cached.stale) {
				this.#cache.refreshHandle(handle, () => this.resolveNoThrow(handle));
			}
			return cached.value;
		}

		// cache miss or expired - fetch fresh
		const did = await this.#resolver.resolve(handle, options);
		this.#cache.setHandle(handle, did);
		return did;
	}

	private async resolveNoThrow(handle: Handle, options?: ResolveHandleOptions): Promise<AtprotoDid | null> {
		try {
			return await this.#resolver.resolve(handle, options);
		} catch {
			return null;
		}
	}
}
