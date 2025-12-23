import { json, type XRPCRouter } from '@atcute/xrpc-server';
import { LocalDanausLegacyAuthListAppPasswords } from '@kelinci/danaus-lexicons';

import { formatAppPasswordPrivilege } from '#app/accounts/app-passwords.ts';
import type { AppContext } from '#app/context.ts';

/**
 * register the `local.danaus.legacyAuth.listAppPasswords` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const listAppPasswords = (router: XRPCRouter, context: AppContext) => {
	const { accountManager, authVerifier } = context;

	router.addQuery(LocalDanausLegacyAuthListAppPasswords, {
		async handler({ request }) {
			const auth = await authVerifier.web(request);

			const passwords = accountManager.listAppPasswords(auth.did).map((password) => ({
				name: password.name,
				privilege: formatAppPasswordPrivilege(password.privilege),
				createdAt: password.created_at.toISOString(),
			}));

			return json({ passwords });
		},
	});
};
