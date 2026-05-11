import { ComAtprotoSyncGetRepo } from '@atcute/atproto';
import { InvalidRequestError, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

import { assertRepoAvailability, carStreamFromBlocks, isUserOrAdmin } from './sync/utils';

/**
 * register the `com.atproto.sync.getRepo` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getRepo = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, accountManager, authVerifier } = context;

	router.addQuery(ComAtprotoSyncGetRepo, {
		async handler({ params, request }) {
			const auth = await authVerifier.authorizationOrAdminOptional(request);
			const { did, since } = params;

			assertRepoAvailability(accountManager, did, isUserOrAdmin(auth, did));
			void since;

			const { root, blocks } = await actorManager.read(did, (store) => {
				return {
					root: store.repo.getRoot(),
					blocks: store.repo.listBlocks(),
				};
			});

			if (!root) {
				throw new InvalidRequestError({ error: 'RepoNotFound', message: `repository not found` });
			}

			blocks.set(root.cid, root.bytes);

			const stream = carStreamFromBlocks([root.cid], blocks);

			return new Response(stream, {
				headers: {
					'content-type': 'application/vnd.ipld.car',
				},
			});
		},
	});
};
