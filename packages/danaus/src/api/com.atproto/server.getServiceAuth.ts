import { ComAtprotoServerGetServiceAuth } from '@atcute/atproto';
import { InvalidRequestError, json, type XRPCRouter } from '@atcute/xrpc-server';
import { createServiceJwt } from '@atcute/xrpc-server/auth';

import { AuthScope } from '#app/auth/scopes.ts';
import type { AppContext } from '#app/context.ts';

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/**
 * register the `com.atproto.server.getServiceAuth` endpoint.
 * @param router xrpc router
 * @param context app context
 */
export const getServiceAuth = (router: XRPCRouter, context: AppContext) => {
	const { actorManager, authVerifier } = context;

	router.addQuery(ComAtprotoServerGetServiceAuth, {
		async handler({ request, params }) {
			const auth = await authVerifier.authorization(request, {
				additional: [AuthScope.Takendown],
			});

			const did = auth.did;
			const { aud, exp, lxm } = params;

			if (!lxm) {
				throw new InvalidRequestError({
					error: 'InvalidRequest',
					message: `lxm is required`,
				});
			}

			// validate expiration
			if (exp !== undefined) {
				const now = Math.floor(Date.now() / 1000);
				const diff = exp - now;

				if (diff < 0) {
					throw new InvalidRequestError({
						error: 'BadExpiration',
						message: `expiration is in past`,
					});
				}

				if (diff > HOUR) {
					throw new InvalidRequestError({
						error: 'BadExpiration',
						message: `cannot request a token with an expiration more than an hour in the future`,
					});
				}
			}

			// load user's signing keypair
			const keypair = await actorManager.importKeypair(did);

			// calculate expiresIn from absolute exp
			const expiresIn = exp !== undefined ? exp - Math.floor(Date.now() / 1000) : MINUTE;

			const token = await createServiceJwt({
				keypair: keypair,
				issuer: did,
				audience: aud,
				lxm: lxm,
				expiresIn: expiresIn,
			});

			return json({ token });
		},
	});
};
