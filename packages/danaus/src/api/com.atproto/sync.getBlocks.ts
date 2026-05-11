import { ComAtprotoSyncGetBlocks } from '@atcute/atproto';
import { InvalidRequestError, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

import { assertRepoAvailability, carStreamFromBlocks, isUserOrAdmin } from './sync/utils';

/**
 * register the `com.atproto.sync.getBlocks` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getBlocks = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, accountManager, authVerifier } = context;

	router.addQuery(ComAtprotoSyncGetBlocks, {
		async handler({ params, request }) {
			const auth = await authVerifier.authorizationOrAdminOptional(request);
			const { did, cids } = params;

			assertRepoAvailability(accountManager, did, isUserOrAdmin(auth, did));

			const blocks = await actorManager.read(did, (store) => store.repo.getBlocksByCid(cids));
			const missing = cids.filter((cid) => !blocks.has(cid));
			if (missing.length > 0) {
				throw new InvalidRequestError({
					error: 'BlockNotFound',
					message: `blocks not found: ${missing.join(', ')}`,
				});
			}

			const stream = carStreamFromBlocks([], blocks);

			return new Response(stream, {
				headers: {
					'content-type': 'application/vnd.ipld.car',
				},
			});
		},
	});
};
