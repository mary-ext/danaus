import { ComAtprotoServerDeleteSession } from '@atcute/atproto';
import type { XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.server.deleteSession` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const deleteSession = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, authVerifier } = context;

	router.addProcedure(ComAtprotoServerDeleteSession, {
		async handler({ request }) {
			const auth = await authVerifier.refresh(request);

			accountManager.deleteLegacySession(auth.tokenId);
		},
	});
};
