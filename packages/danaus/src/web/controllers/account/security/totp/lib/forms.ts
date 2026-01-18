import { XRPCError } from '@atcute/xrpc-server';
import { redirect } from '@oomfware/fetch-router';
import { form, invalid } from '@oomfware/forms';

import * as v from 'valibot';

import { decodeSecret, verifyTotpCode } from '#app/accounts/totp.ts';
import { normalizeWhitespace } from '#app/utils/schema.ts';
import { requireSudo } from '#app/web/lib/forms.ts';

import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';
import { routes } from '#web/routes.ts';

/**
 * sets up a new TOTP credential after verifying the code.
 */
export const setupTotpForm = form(
	v.object({
		name: v.optional(v.pipe(v.string(), normalizeWhitespace, v.maxLength(32, `Name is too long`))),
		secret: v.pipe(v.string()),
		_code: v.pipe(v.string(), v.length(6, `Enter the 6-digit code`)),
	}),
	async (data, issue) => {
		const { mfaManager } = getAppContext();
		const { did } = getSession();

		// verify the code against the provided secret
		let secretBytes: Uint8Array;
		try {
			secretBytes = decodeSecret(data.secret);
		} catch {
			invalid(issue._code(`Invalid setup, please try again`));
		}

		const counter = await verifyTotpCode(secretBytes, data._code, null);
		if (counter === null) {
			invalid(issue._code(`Invalid code, please try again`));
		}

		requireSudo();

		// store the credential
		try {
			mfaManager.createTotpCredential({
				did: did,
				name: data.name,
				secret: secretBytes,
				lastUsedCounter: counter,
			});
		} catch (err) {
			if (err instanceof XRPCError && err.status === 400) {
				switch (err.error) {
					case 'DuplicateTotpName': {
						invalid(issue.name(`An authenticator with this name already exists`));
					}
					case 'TooManyTotpCredentials': {
						invalid(`You've reached the maximum number of authenticators allowed`);
					}
				}
			}
			throw err;
		}

		redirect(routes.account.security.overview.href());
	},
);

/**
 * removes a TOTP credential. requires sudo mode.
 */
export const removeTotpForm = form(
	v.object({
		id: v.pipe(v.string(), v.toNumber(), v.safeInteger()),
	}),
	async (data) => {
		const { mfaManager } = getAppContext();
		const { did } = getSession();

		requireSudo();
		mfaManager.deleteTotpCredential(did, data.id);

		redirect(routes.account.security.overview.href());
	},
);
