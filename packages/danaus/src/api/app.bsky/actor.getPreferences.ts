import { AppBskyActorDefs, AppBskyActorGetPreferences } from '@atcute/bluesky';
import * as v from '@atcute/lexicons';
import { json, type XRPCRouter } from '@atcute/xrpc-server';

import type { AppContext } from '#app/context.ts';
import { upsert } from '#app/utils/array.ts';

/**
 * register the `app.bsky.actor.getPreferences` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getPreferences = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, authVerifier } = context;

	router.addQuery(AppBskyActorGetPreferences, {
		async handler({ request }) {
			const auth = await authVerifier.authorization(request);

			let preferences = await actorManager.read(auth.did, (store) => {
				return store.pref.getLegacyPreferences() as v.InferOutput<AppBskyActorDefs.preferencesSchema>;
			});

			preferences = upsert(preferences, (pref) => pref.$type === 'app.bsky.actor.defs#personalDetailsPref', {
				$type: 'app.bsky.actor.defs#personalDetailsPref',
				birthDate: '2000-01-01T00:00:00.000Z',
			});

			preferences = upsert(preferences, (pref) => pref.$type === 'app.bsky.actor.defs#declaredAgePref', {
				$type: 'app.bsky.actor.defs#declaredAgePref',
				isOverAge18: true,
			});

			return json({
				preferences: preferences,
			});
		},
	});
};
