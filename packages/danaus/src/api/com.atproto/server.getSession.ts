import { ComAtprotoServerGetSession } from '@atcute/atproto';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import { formatAccountStatus } from '#app/accounts/types.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.server.getSession` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getSession = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, authVerifier } = context;

	router.addQuery(ComAtprotoServerGetSession, {
		async handler({ request }) {
			const auth = await authVerifier.authorization(request);

			const account = accountManager.getAccount(auth.did, {
				includeDeactivated: true,
				includeTakenDown: true,
			});
			if (!account) {
				throw new InvalidRequestError({
					error: 'AccountNotFound',
					description: `could not find user info for account: ${auth.did}`,
				});
			}

			const status = formatAccountStatus(account);

			const handle = account.handle;
			if (!handle) {
				throw new InvalidRequestError({ error: 'HandleNotFound', description: `handle not found` });
			}

			return json({
				did: account.did,
				handle: handle,
				email: account.email ?? undefined,
				emailConfirmed: account.email_confirmed_at !== null,
				active: status.active,
				status: status.status,
			});
		},
	});
};
