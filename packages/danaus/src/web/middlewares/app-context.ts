import { createInjectionKey, type Middleware } from '@oomfware/fetch-router';
import { getContext } from '@oomfware/fetch-router/middlewares/async-context';

import type { AppContext } from '#app/context.ts';

const appContextKey = createInjectionKey<AppContext>();

/**
 * middleware that provides the AppContext to the request context store.
 * @param ctx the application context to provide
 */
export const provideAppContext = (ctx: AppContext): Middleware => {
	return async ({ store }, next) => {
		store.provide(appContextKey, ctx);
		return next();
	};
};

/**
 * retrieves the AppContext from the current request context.
 * must be called within a request handler after the provideAppContext middleware.
 * @returns the application context
 */
export const getAppContext = (): AppContext => {
	const { store } = getContext();
	const ctx = store.inject(appContextKey);

	if (ctx === undefined) {
		throw new Error('AppContext not found in request context');
	}

	return ctx;
};
