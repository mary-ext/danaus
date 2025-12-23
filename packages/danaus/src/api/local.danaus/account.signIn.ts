import { AuthRequiredError, json, type XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausAccountSignIn } from '@kelinci/danaus-lexicons';

import { AccountStatus } from '#app/accounts/types.ts';
import { setWebSessionToken } from '#app/auth/web.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `local.danaus.account.signIn` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const signIn = (router: XRPCRouter, context: AppContext) => {
	const { accountManager } = context;

	router.addProcedure(LocalDanausAccountSignIn, {
		async handler({ input, request }) {
			const account = await accountManager.verifyAccountPassword(input.identifier, input.password);
			if (!account || !account.handle) {
				throw new AuthRequiredError({
					error: 'InvalidCredentials',
					description: `invalid identifier or password`,
				});
			}

			const status = accountManager.getAccountStatus(account.did);
			if (status !== AccountStatus.Active) {
				throw new AuthRequiredError({
					error: status === 'takendown' ? 'AccountTakedown' : 'AccountDeactivated',
					description: `account is not active`,
				});
			}

			const { session, token } = await accountManager.createWebSession({
				did: account.did,
				remember: input.remember ?? false,
				userAgent: request.headers.get('user-agent') ?? undefined,
			});

			setWebSessionToken(request, token, {
				expires: session.expires_at,
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
			});

			return json({
				did: account.did,
				handle: account.handle,
			});
		},
	});
};
