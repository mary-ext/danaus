import { ComAtprotoIdentityResolveHandle } from '@atcute/atproto';
import { isHandle } from '@atcute/lexicons/syntax';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.identity.resolveHandle` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const resolveHandle = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, config, handleResolver } = context;

	router.addQuery(ComAtprotoIdentityResolveHandle, {
		async handler({ params }) {
			const handle = params.handle.toLowerCase();

			if (!isHandle(handle)) {
				throw new InvalidRequestError({ error: 'InvalidHandle', description: `invalid handle` });
			}

			// check local accounts first
			const account = accountManager.getAccount(handle);
			if (account) {
				return json({ did: account.did });
			}

			// check if this handle is supposed to be on our server
			const isServiceHandle = config.identity.serviceHandleDomains.some(
				(domain) => handle.endsWith(domain) || handle === domain.slice(1),
			);
			if (isServiceHandle) {
				// handle should be in our DB but wasn't found
				throw new InvalidRequestError({ error: 'HandleNotFound', description: `unable to resolve handle` });
			}

			// resolve external handles
			const did = await handleResolver.resolve(handle).catch(() => undefined);
			if (!did) {
				throw new InvalidRequestError({ error: 'HandleNotFound', description: `unable to resolve handle` });
			}

			return json({ did });
		},
	});
};
