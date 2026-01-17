import { createInjectionKey, type Middleware } from '@oomfware/fetch-router';
import { getContext } from '@oomfware/fetch-router/middlewares/async-context';

// #region cache node types

const enum CacheStatus {
	UNTERMINATED = 0,
	TERMINATED = 1,
	ERRORED = 2,
}

type Primitive = string | number | null | undefined | symbol | boolean;

type UnterminatedCacheNode<T> = {
	s: CacheStatus.UNTERMINATED;
	v: undefined;
	o: WeakMap<WeakKey, CacheNode<T>> | null;
	p: Map<Primitive, CacheNode<T>> | null;
};

type TerminatedCacheNode<T> = {
	s: CacheStatus.TERMINATED;
	v: T;
	o: WeakMap<WeakKey, CacheNode<T>> | null;
	p: Map<Primitive, CacheNode<T>> | null;
};

type ErroredCacheNode<T> = {
	s: CacheStatus.ERRORED;
	v: unknown;
	o: WeakMap<WeakKey, CacheNode<T>> | null;
	p: Map<Primitive, CacheNode<T>> | null;
};

type CacheNode<T> = UnterminatedCacheNode<T> | TerminatedCacheNode<T> | ErroredCacheNode<T>;

const createCacheNode = <T>(): CacheNode<T> => {
	return {
		s: CacheStatus.UNTERMINATED,
		v: undefined,
		o: null,
		p: null,
	};
};

// #endregion

// #region cache store

type CacheStore = WeakMap<WeakKey, CacheNode<unknown>>;

const cacheStoreKey = createInjectionKey<CacheStore>();

/**
 * middleware that provides a cache store scoped to the current request.
 */
export const provideCache = (): Middleware => {
	return async ({ store }, next) => {
		store.provide(cacheStoreKey, new WeakMap());
		return next();
	};
};

const getCacheStore = (): CacheStore | undefined => {
	try {
		return getContext().store.inject(cacheStoreKey);
	} catch {
		return undefined;
	}
};

// #endregion

// #region cache function

/**
 * wraps a function to memoize its results for the duration of the current request.
 * arguments are compared by identity (===) with special handling for objects via WeakMap.
 * @param fn the function to memoize
 * @returns a memoized version of the function
 */
export const cache = <A extends unknown[], T>(fn: (...args: A) => T): ((...args: A) => T) => {
	return function (this: unknown, ...args: A): T {
		const store = getCacheStore();
		if (!store) {
			return fn.apply(this, args);
		}

		let cacheNode: CacheNode<T>;
		const fnNode = store.get(fn) as CacheNode<T> | undefined;
		if (fnNode === undefined) {
			cacheNode = createCacheNode();
			store.set(fn, cacheNode);
		} else {
			cacheNode = fnNode;
		}

		// walk through arguments to find/create the cache node
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];

			if (typeof arg === 'function' || (typeof arg === 'object' && arg !== null)) {
				// objects go into a WeakMap
				let objectCache = cacheNode.o;
				if (objectCache === null) {
					cacheNode.o = objectCache = new WeakMap();
				}

				const objectNode = objectCache.get(arg);
				if (objectNode === undefined) {
					cacheNode = createCacheNode();
					objectCache.set(arg, cacheNode);
				} else {
					cacheNode = objectNode;
				}
			} else {
				// primitives go into a regular Map
				let primitiveCache = cacheNode.p;
				if (primitiveCache === null) {
					cacheNode.p = primitiveCache = new Map();
				}

				const primitiveNode = primitiveCache.get(arg as Primitive);
				if (primitiveNode === undefined) {
					cacheNode = createCacheNode();
					primitiveCache.set(arg as Primitive, cacheNode);
				} else {
					cacheNode = primitiveNode;
				}
			}
		}

		// return cached value or compute
		if (cacheNode.s === CacheStatus.TERMINATED) {
			return cacheNode.v;
		}
		if (cacheNode.s === CacheStatus.ERRORED) {
			throw cacheNode.v;
		}

		try {
			const result = fn.apply(this, args);

			const terminatedNode = cacheNode as unknown as TerminatedCacheNode<T>;
			terminatedNode.s = CacheStatus.TERMINATED;
			terminatedNode.v = result;

			return result;
		} catch (error) {
			const erroredNode = cacheNode as unknown as ErroredCacheNode<T>;
			erroredNode.s = CacheStatus.ERRORED;
			erroredNode.v = error;

			throw error;
		}
	};
};

cache.decorate = <This, A extends unknown[], T>(
	target: (this: This, ...args: A) => T,
	_context: ClassMethodDecoratorContext,
) => {
	return cache(target);
};

// #endregion
