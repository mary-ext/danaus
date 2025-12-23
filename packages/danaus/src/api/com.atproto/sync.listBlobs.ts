import { ComAtprotoSyncListBlobs } from '@atcute/atproto';
import { json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

import { assertRepoAvailability, isUserOrAdmin } from './sync/utils';

/**
 * register the `com.atproto.sync.listBlobs` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const listBlobs = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, accountManager, authVerifier } = context;

	router.addQuery(ComAtprotoSyncListBlobs, {
		async handler({ params, request }) {
			const auth = await authVerifier.authorizationOrAdminOptional(request);
			const { did, since, limit, cursor } = params;

			assertRepoAvailability(accountManager, did, isUserOrAdmin(auth, did));

			const blobCids = await actorManager.read(did, (store) => {
				return store.blob.listBlobs({ since, limit, cursor });
			});

			return json({
				cids: blobCids,
				cursor: blobCids.at(-1),
			});
		},
	});
};
