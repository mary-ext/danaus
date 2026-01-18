import { json, type XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausAdminGetStats } from '@kelinci/danaus-lexicons';

import type { AppContext } from '#app/context.ts';

/**
 * register the `local.danaus.admin.getStats` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getStats = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, inviteCodeManager, authVerifier, sequencer } = context;

	router.addQuery(LocalDanausAdminGetStats, {
		async handler({ request }) {
			await authVerifier.admin(request);

			return json({
				accounts: accountManager.getAccountStats(),
				sequencer: sequencer.getStats(),
				inviteCodes: inviteCodeManager.getInviteCodeStats(),
			});
		},
	});
};
