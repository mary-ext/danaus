import { ComAtprotoServerRefreshSession } from '@atcute/atproto';
import { AuthRequiredError, InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import { AccountStatus, formatAccountStatus } from '#app/accounts/types.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.server.refreshSession` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const refreshSession = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, legacyAuthManager, authVerifier } = context;

	router.addProcedure(ComAtprotoServerRefreshSession, {
		async handler({ request }) {
			const auth = await authVerifier.refresh(request);

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
			if (status.status === AccountStatus.Takendown) {
				throw new AuthRequiredError({
					error: 'AccountTakedown',
					description: `account has been taken down`,
				});
			}

			const handle = account.handle;
			if (!handle) {
				throw new InvalidRequestError({ error: 'HandleNotFound', description: `handle not found` });
			}

			const { accessJwt, refreshJwt } = await legacyAuthManager.rotateLegacyRefresh(auth.tokenId);

			return json({
				did: account.did,
				handle: handle,
				accessJwt: accessJwt,
				refreshJwt: refreshJwt,
				active: status.active,
				status: status.status,
			});
		},
	});
};
