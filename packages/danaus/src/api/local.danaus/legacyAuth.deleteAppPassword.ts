import type { XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausLegacyAuthDeleteAppPassword } from '@kelinci/danaus-lexicons';

import type { AppContext } from '#app/context.ts';

/**
 * register the `local.danaus.legacyAuth.deleteAppPassword` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const deleteAppPassword = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, authVerifier } = context;

	router.addProcedure(LocalDanausLegacyAuthDeleteAppPassword, {
		async handler({ input, request }) {
			const auth = await authVerifier.web(request);

			accountManager.deleteAppPassword(auth.did, input.name);
		},
	});
};
