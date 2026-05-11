import { ComAtprotoSyncGetRepoStatus } from '@atcute/atproto';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import { formatAccountStatus } from '#app/accounts/types.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.sync.getRepoStatus` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getRepoStatus = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, actorManager } = context;

	router.addQuery(ComAtprotoSyncGetRepoStatus, {
		async handler({ params }) {
			const { did } = params;

			const account = accountManager.getAccount(did, {
				includeDeactivated: true,
				includeTakenDown: true,
			});
			if (!account) {
				throw new InvalidRequestError({ error: 'RepoNotFound', message: `repository not found` });
			}

			const { active, status } = formatAccountStatus(account);
			let rev: string | undefined;

			if (active) {
				const root = await actorManager.read(did, (store) => store.repo.getRoot());
				if (!root) {
					throw new InvalidRequestError({ error: 'RepoNotFound', message: `repository not found` });
				}

				rev = root.rev;
			}

			return json({
				did: did,
				active: active,
				status: status,
				rev: rev,
			});
		},
	});
};
