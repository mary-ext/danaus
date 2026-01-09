import { ComAtprotoSyncGetBlob } from '@atcute/atproto';
import { InvalidRequestError, type XRPCRouter } from '@atcute/xrpc-server';

import { AuthScope } from '#app/auth/scopes.ts';
import type { AppContext } from '#app/context.ts';

import { assertRepoAvailability, isUserOrAdmin } from './sync/utils';

/**
 * register the `com.atproto.sync.getBlob` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getBlob = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, accountManager, authVerifier } = context;

	router.addQuery(ComAtprotoSyncGetBlob, {
		async handler({ params, request }) {
			const auth = await authVerifier.authorizationOrAdminOptional(request, {
				additional: [AuthScope.Takendown],
			});

			const { did, cid } = params;

			assertRepoAvailability(accountManager, did, isUserOrAdmin(auth, did));

			const result = await actorManager.read(did, (store) => store.blob.getBlob(cid));
			if (!result) {
				throw new InvalidRequestError({ error: 'BlobNotFound', description: `blob not found` });
			}

			const blob = result.blob;

			return new Response(blob.size > 0 ? blob.stream() : null, {
				status: 200,
				headers: {
					'content-type': result.metadata.mimeType,
					'content-length': `${result.metadata.size}`,
				},
			});
		},
	});
};
