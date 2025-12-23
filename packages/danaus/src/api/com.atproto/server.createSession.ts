import { ComAtprotoServerCreateSession } from '@atcute/atproto';
import type { Handle } from '@atcute/lexicons';
import { AuthRequiredError, InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';

import { AccountStatus, formatAccountStatus } from '#app/accounts/types.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `com.atproto.server.createSession` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const createSession = (router: XRPCRouter, context: AppContext) => {
	const { accountManager } = context;

	router.addProcedure(ComAtprotoServerCreateSession, {
		async handler({ input }) {
			const auth = await accountManager.verifyLegacyCredentials(input.identifier, input.password);
			if (!auth) {
				throw new AuthRequiredError({
					error: 'InvalidCredentials',
					description: `invalid identifier or password`,
				});
			}

			const { account, appPassword } = auth;
			const status = formatAccountStatus(account);

			if (!input.allowTakendown && status.status === AccountStatus.Takendown) {
				throw new AuthRequiredError({
					error: 'AccountTakedown',
					description: `account has been taken down`,
				});
			}

			const handle = account.handle;
			if (!handle) {
				throw new InvalidRequestError({ error: 'HandleNotFound', description: `handle not found` });
			}

			const { accessJwt, refreshJwt } = await accountManager.createLegacySession({
				did: account.did,
				appPassword: appPassword,
			});

			return json({
				did: account.did,
				handle: handle as Handle,
				email: account.email ?? undefined,
				emailConfirmed: account.email_confirmed_at !== null,
				accessJwt: accessJwt,
				refreshJwt: refreshJwt,
				active: status.active,
				status: status.status,
			});
		},
	});
};
