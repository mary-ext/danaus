import type { XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausAccountSignOut } from '@kelinci/danaus-lexicons';

import { setWebSessionToken } from '#app/auth/web.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `local.danaus.account.signOut` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const signOut = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, authVerifier } = context;

	router.addProcedure(LocalDanausAccountSignOut, {
		async handler({ request }) {
			const auth = await authVerifier.web(request);

			accountManager.deleteWebSession(auth.sessionId);
			setWebSessionToken(request, '', {
				expires: new Date(0),
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
			});

			return new Response(null, { status: 200 });
		},
	});
};
