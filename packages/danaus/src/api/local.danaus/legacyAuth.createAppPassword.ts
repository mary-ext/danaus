import { json, type XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausLegacyAuthCreateAppPassword } from '@kelinci/danaus-lexicons';

import { parseAppPasswordPrivilege } from '#app/accounts/app-passwords.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `local.danaus.legacyAuth.createAppPassword` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const createAppPassword = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, authVerifier } = context;

	router.addProcedure(LocalDanausLegacyAuthCreateAppPassword, {
		async handler({ input, request }) {
			const auth = await authVerifier.web(request);

			const privilege = parseAppPasswordPrivilege(input.privilege);
			const { appPassword, secret } = await accountManager.createAppPassword({
				did: auth.did,
				name: input.name,
				privilege: privilege,
			});

			return json({
				details: {
					name: appPassword.name,
					privilege: input.privilege,
					createdAt: appPassword.created_at.toISOString(),
				},
				secret: secret,
			});
		},
	});
};
