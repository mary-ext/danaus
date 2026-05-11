import { ComAtprotoSyncGetLatestCommit } from '@atcute/atproto';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

import { assertRepoAvailability, isUserOrAdmin } from './sync/utils';

/**
 * register the `com.atproto.sync.getLatestCommit` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getLatestCommit = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, accountManager, authVerifier } = context;

	router.addQuery(ComAtprotoSyncGetLatestCommit, {
		async handler({ params, request }) {
			const auth = await authVerifier.authorizationOrAdminOptional(request);
			const { did } = params;

			assertRepoAvailability(accountManager, did, isUserOrAdmin(auth, did));

			const root = await actorManager.read(did, (store) => store.repo.getRoot());
			if (!root) {
				throw new InvalidRequestError({ error: 'RepoNotFound', message: `repository not found` });
			}

			return json({
				cid: root.cid,
				rev: root.rev,
			});
		},
	});
};
