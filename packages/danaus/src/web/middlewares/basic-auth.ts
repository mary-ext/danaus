import type { Middleware } from '@oomfware/fetch-router';

import { parseBasicAuth } from '#app/auth/verifier.ts';

import { getAppContext } from './app-context.ts';

const REALM = 'admin';

/**
 * middleware that requires HTTP Basic Authentication for admin access.
 * uses the admin password from app config via async context.
 */
export const requireAdmin = (): Middleware => {
	return async ({ request }, next) => {
		const { config } = getAppContext();
		const adminPassword = config.secrets.adminPassword;

		if (adminPassword === null) {
			return new Response('Administration UI is disabled', { status: 403 });
		}

		const auth = parseBasicAuth(request);
		if (auth === null || auth.password !== adminPassword) {
			return new Response('Unauthorized', {
				status: 401,
				headers: { 'www-authenticate': `Basic realm="${REALM}", charset="UTF-8"` },
			});
		}

		return next();
	};
};
