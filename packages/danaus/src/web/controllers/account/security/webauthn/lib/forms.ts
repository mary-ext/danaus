import type { Did } from '@atcute/lexicons/syntax';
import { XRPCError } from '@atcute/xrpc-server';
import { redirect } from '@oomfware/fetch-router';
import { form, invalid } from '@oomfware/forms';

import * as v from 'valibot';

import { WebAuthnCredentialType } from '#app/accounts/db/schema.ts';
import { generateWebAuthnRegistrationOptions, verifyWebAuthnRegistration } from '#app/accounts/webauthn.ts';
import { normalizeWhitespace } from '#app/utils/schema.ts';
import { requireSudo } from '#app/web/lib/forms.ts';

import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';
import { routes } from '#web/routes.ts';

export interface WebAuthnRegistrationState {
	token: string;
	options: Awaited<ReturnType<typeof generateWebAuthnRegistrationOptions>>;
}

/**
 * initiates WebAuthn registration by generating a challenge.
 * @param did account DID
 * @param userName user display name (handle)
 * @param credentialType type of credential to register
 * @returns registration state with token and options
 */
export const initiateWebAuthnRegistration = async (
	did: Did,
	userName: string,
	credentialType: WebAuthnCredentialType,
): Promise<WebAuthnRegistrationState> => {
	const { mfaManager, config } = getAppContext();

	const existingCredentials = mfaManager.listWebAuthnCredentials(did);

	const options = await generateWebAuthnRegistrationOptions({
		rpId: config.service.hostname,
		rpName: config.service.branding.name,
		userId: did,
		userName: userName,
		excludeCredentials: existingCredentials,
		credentialType,
	});

	// store the challenge
	const token = mfaManager.createWebAuthnRegistrationChallenge(did, options.challenge);

	return { token, options };
};

/**
 * completes WebAuthn registration by verifying the response and storing the credential.
 */
export const completeWebAuthnForm = form(
	v.object({
		token: v.pipe(v.string(), v.minLength(1)),
		credentialType: v.picklist(['security-key', 'passkey']),
		name: v.optional(v.pipe(v.string(), normalizeWhitespace, v.maxLength(32, `Name is too long`))),
		response: v.pipe(
			v.string(),
			v.parseJson(),
			v.object({
				id: v.string(),
				rawId: v.string(),
				type: v.literal('public-key'),
				response: v.object({
					clientDataJSON: v.string(),
					attestationObject: v.string(),
					transports: v.optional(
						v.array(v.picklist(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'])),
					),
				}),
				authenticatorAttachment: v.optional(v.picklist(['cross-platform', 'platform'])),
				clientExtensionResults: v.record(v.string(), v.unknown()),
			}),
		),
	}),
	async (data, issue) => {
		const { mfaManager, config } = getAppContext();
		const { did } = getSession();

		// get the challenge
		const challenge = mfaManager.getWebAuthnRegistrationChallenge(data.token);
		if (!challenge) {
			invalid(`Registration expired, please try again`);
		}

		if (challenge.did !== did) {
			invalid(`Invalid registration`);
		}

		// verify the registration
		let verification;
		try {
			verification = await verifyWebAuthnRegistration({
				response: data.response,
				expectedChallenge: challenge.challenge,
				expectedOrigin: config.service.publicUrl,
				expectedRpId: config.service.hostname,
				requireUserVerification: data.credentialType === 'passkey',
			});
		} catch {
			invalid(`Registration failed, please try again`);
		}

		if (!verification.verified || !verification.registrationInfo) {
			invalid(`Registration failed, please try again`);
		}

		// delete the challenge
		mfaManager.deleteWebAuthnRegistrationChallenge(data.token);

		requireSudo();

		// store the credential
		const { registrationInfo } = verification;
		const credentialType =
			data.credentialType === 'passkey' ? WebAuthnCredentialType.Passkey : WebAuthnCredentialType.SecurityKey;

		try {
			mfaManager.createWebAuthnCredential({
				did: did,
				type: credentialType,
				name: data.name,
				credentialId: registrationInfo.credential.id,
				publicKey: registrationInfo.credential.publicKey,
				counter: registrationInfo.credential.counter,
				transports: registrationInfo.credential.transports,
			});
		} catch (err) {
			if (err instanceof XRPCError && err.status === 400) {
				switch (err.error) {
					case 'DuplicateWebAuthnName': {
						invalid(issue.name(`A security key with this name already exists`));
					}
					case 'DuplicateCredentialId': {
						invalid(`This security key is already registered`);
					}
					case 'TooManyWebAuthnCredentials': {
						invalid(`You've reached the maximum number of security keys allowed`);
					}
				}
			}
			throw err;
		}

		redirect(routes.account.security.overview.href());
	},
);

/**
 * removes a WebAuthn credential. requires sudo mode.
 */
export const removeWebAuthnForm = form(
	v.object({
		id: v.pipe(v.string(), v.toNumber(), v.safeInteger()),
	}),
	async (data) => {
		const { mfaManager } = getAppContext();
		const { did } = getSession();

		requireSudo();
		mfaManager.deleteWebAuthnCredential(did, data.id);

		redirect(routes.account.security.overview.href());
	},
);
