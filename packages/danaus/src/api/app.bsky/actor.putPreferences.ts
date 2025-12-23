import { AppBskyActorPutPreferences } from '@atcute/bluesky';
import { json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';

/**
 * register the `app.bsky.actor.putPreferences` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const putPreferences = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, authVerifier } = context;

	router.addProcedure(AppBskyActorPutPreferences, {
		async handler({ input, request }) {
			const auth = await authVerifier.authorization(request);

			await actorManager.transact(auth.did, (store) => {
				store.pref.putLegacyPreferences(input.preferences);
			});

			return json({});
		},
	});
};
