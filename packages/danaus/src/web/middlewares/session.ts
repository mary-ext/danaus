import { createInjectionKey, redirect, type Middleware } from '@oomfware/fetch-router';
import { getContext } from '@oomfware/fetch-router/middlewares/async-context';

import type { WebSession } from '#app/accounts/manager.ts';
import { readWebSessionToken, verifyWebSessionToken } from '#app/auth/web.ts';

import { routes } from '../routes.ts';

import { getAppContext } from './app-context.ts';

const sessionKey = createInjectionKey<WebSession>();

/**
 * middleware that requires a valid web session.
 * redirects to login page if no session is found.
 */
export const requireSession = (): Middleware => {
	return async ({ request, url, store }, next) => {
		const { accountManager, config } = getAppContext();
		const path = url.pathname;

		const redirectUrl = routes.login.show.href(undefined, { redirect: path });

		const token = readWebSessionToken(request);
		if (!token) {
			redirect(redirectUrl);
		}

		const sessionId = verifyWebSessionToken(config.secrets.jwtKey, token);
		if (!sessionId) {
			redirect(redirectUrl);
		}

		const session = accountManager.getWebSession(sessionId);
		if (!session) {
			redirect(redirectUrl);
		}

		store.provide(sessionKey, session);
		return next();
	};
};

/**
 * retrieves the current web session from the request context.
 * must be called within a request handler after the requireSession middleware.
 * @returns the web session
 */
export const getSession = (): WebSession => {
	const session = getContext().store.inject(sessionKey);
	if (!session) {
		throw new Error('Session not found in request context');
	}

	return session;
};
