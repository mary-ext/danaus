import type { Did } from '@atcute/lexicons';
import { XRPCError } from '@atcute/xrpc-server';
import { redirect } from '@oomfware/fetch-router';
import { getContext } from '@oomfware/fetch-router/middlewares/async-context';
import { form, invalid } from '@oomfware/forms';

import * as v from 'valibot';

import type { Account } from '#app/accounts/manager.ts';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '#app/accounts/passwords.ts';
import { isRecoveryCode, isTotpCode } from '#app/accounts/totp.ts';
import { verifyWebAuthnAuthentication } from '#app/accounts/webauthn.ts';
import { setWebSessionToken } from '#app/auth/web.ts';

import { getAppContext } from '#web/middlewares/app-context.ts';
import { routes } from '#web/routes.ts';
import { getServer } from '#web/server-context.ts';

export type AuthFactor = 'totp' | 'recovery' | 'password' | 'webauthn';

interface VerifyFactorOptions {
	did: Did;
	factor: AuthFactor;
	code: string;
	allowedFactors: AuthFactor[];
}

/**
 * verifies an authentication factor (TOTP, backup code, or password).
 * calls invalid() on failure.
 * @param options verification options
 */
const verifyFactor = async (options: VerifyFactorOptions): Promise<void> => {
	const { accountManager, mfaManager } = getAppContext();
	const { did, factor, code, allowedFactors } = options;

	if (!allowedFactors.includes(factor)) {
		invalid(`Invalid authentication method`);
	}

	switch (factor) {
		case 'totp': {
			if (!isTotpCode(code)) {
				invalid(`Invalid verification code`);
			}

			const valid = await mfaManager.verifyAccountTotpCode(did, code);
			if (!valid) {
				invalid(`Invalid verification code`);
			}

			break;
		}
		case 'recovery': {
			if (!isRecoveryCode(code)) {
				invalid(`Invalid recovery code`);
			}

			const valid = mfaManager.consumeRecoveryCode(did, code);
			if (!valid) {
				invalid(`Invalid recovery code`);
			}

			break;
		}
		case 'password': {
			if (code.length < MIN_PASSWORD_LENGTH || code.length > MAX_PASSWORD_LENGTH) {
				invalid(`Invalid password`);
			}

			try {
				const account = await accountManager.verifyAccountPassword(did, code);
				if (account === null) {
					invalid(`Invalid password`);
				}
			} catch (err) {
				if (err instanceof XRPCError && err.status === 400) {
					switch (err.error) {
						case 'InvalidPassword': {
							invalid(`Invalid password`);
						}
					}
				}

				throw err;
			}

			break;
		}
		default: {
			invalid(`Invalid authentication method`);
		}
	}
};

export const loginForm = form(
	v.object({
		identifier: v.pipe(v.string(), v.minLength(1, `Enter your email or username`)),
		_password: v.pipe(v.string(), v.minLength(1, `Enter your password`)),
		remember: v.optional(v.boolean()),
		redirect: v.pipe(v.string(), v.minLength(1)),
	}),
	async (data, issue) => {
		const { accountManager, mfaManager, webSessionManager } = getAppContext();
		const { request } = getContext();

		if (data._password.length < MIN_PASSWORD_LENGTH || data._password.length > MAX_PASSWORD_LENGTH) {
			invalid(issue.identifier(`Invalid account credentials`));
		}

		let account: Account | null;
		try {
			account = await accountManager.verifyAccountPassword(data.identifier, data._password);
			if (account === null) {
				invalid(issue.identifier(`Invalid account credentials`));
			}
		} catch (err) {
			if (err instanceof XRPCError && err.status === 400) {
				switch (err.error) {
					case 'InvalidPassword': {
						invalid(issue.identifier(`Invalid account credentials`));
					}
				}
			}

			throw err;
		}

		// clean up any expired verify challenges
		webSessionManager.cleanupExpiredVerifyChallenges();

		// check if MFA is enabled
		if (mfaManager.getMfaStatus(account.did) !== null) {
			// create verify challenge and redirect
			const token = webSessionManager.createVerifyChallenge(account.did, data.remember ?? false);

			redirect(routes.verify.index.href(undefined, { token, redirect: data.redirect }));
		}

		const { session, token } = await webSessionManager.createWebSession({
			did: account.did,
			remember: data.remember ?? false,
			userAgent: request.headers.get('user-agent') ?? undefined,
			ip: getServer().requestIP(request)?.address,
		});

		setWebSessionToken(request, token, {
			expires: session.expires_at,
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
		});

		redirect(data.redirect);
	},
);

const VERIFY_ALLOWED_MFA_FACTORS: AuthFactor[] = ['totp', 'recovery'];
const VERIFY_ALLOWED_SUDO_MFA_FACTORS: AuthFactor[] = ['totp', 'webauthn', 'recovery'];
const VERIFY_ALLOWED_SUDO_OFA_FACTORS: AuthFactor[] = ['password'];

/** WebAuthn authentication response schema */
const webauthnResponseSchema = v.pipe(
	v.string(),
	v.parseJson(),
	v.object({
		id: v.string(),
		rawId: v.string(),
		type: v.literal('public-key'),
		response: v.object({
			clientDataJSON: v.string(),
			authenticatorData: v.string(),
			signature: v.string(),
			userHandle: v.pipe(
				v.nullish(v.string()),
				v.transform((val) => val ?? undefined),
			),
		}),
		authenticatorAttachment: v.optional(v.picklist(['cross-platform', 'platform'])),
		clientExtensionResults: v.object({
			appid: v.optional(v.boolean()),
			credProps: v.optional(
				v.object({
					rk: v.optional(v.boolean()),
				}),
			),
			hmacCreateSecret: v.optional(v.boolean()),
		}),
	}),
);

export const verifyForm = form(
	v.object({
		challenge: v.string(),
		factor: v.picklist<AuthFactor[]>(['totp', 'recovery', 'password']),
		_code: v.string(),
		redirect: v.string(),
	}),
	async (data) => {
		const { mfaManager, webSessionManager } = getAppContext();
		const { request } = getContext();

		const challenge = webSessionManager.getVerifyChallenge(data.challenge);
		if (challenge === null) {
			redirect(routes.login.index.href(undefined, { redirect: data.redirect }));
		}

		const isSudo = challenge.session_id !== null;

		// determine allowed factors based on mode and MFA status
		let allowedFactors: AuthFactor[];
		if (isSudo) {
			const hasMfa = mfaManager.getMfaStatus(challenge.did) !== null;
			allowedFactors = hasMfa ? VERIFY_ALLOWED_SUDO_MFA_FACTORS : VERIFY_ALLOWED_SUDO_OFA_FACTORS;
		} else {
			allowedFactors = VERIFY_ALLOWED_MFA_FACTORS;
		}

		await verifyFactor({
			did: challenge.did,
			factor: data.factor,
			code: data._code,
			allowedFactors,
		});

		// delete challenge
		webSessionManager.deleteVerifyChallenge(data.challenge);

		if (isSudo) {
			// elevate session and redirect
			webSessionManager.elevateSession(challenge.session_id!);
			redirect(data.redirect);
		} else {
			// MFA login: create new session using remember preference from login
			const { session, token } = await webSessionManager.createWebSession({
				did: challenge.did,
				remember: challenge.remember,
				userAgent: request.headers.get('user-agent') ?? undefined,
				ip: getServer().requestIP(request)?.address,
			});

			setWebSessionToken(request, token, {
				expires: session.expires_at,
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
			});

			redirect(data.redirect);
		}
	},
);

export const passkeyLoginForm = form(
	v.object({
		response: webauthnResponseSchema,
		redirect: v.string(),
	}),
	async (data) => {
		const { mfaManager, webSessionManager, config } = getAppContext();
		const { request } = getContext();

		// find the credential by ID (discoverable flow)
		const credential = mfaManager.getWebAuthnCredentialByCredentialId(data.response.id);
		if (credential === null) {
			invalid(`Passkey not recognized`);
		}

		// extract challenge from clientDataJSON and verify it's one we issued
		const clientDataJSON = JSON.parse(
			Buffer.from(data.response.response.clientDataJSON, 'base64url').toString('utf-8'),
		);
		const challenge = clientDataJSON.challenge;

		if (!mfaManager.consumePasskeyLoginChallenge(challenge)) {
			invalid(`Invalid or expired challenge`);
		}

		try {
			const verification = await verifyWebAuthnAuthentication({
				response: data.response,
				expectedChallenge: challenge,
				expectedOrigin: config.service.publicUrl,
				expectedRpId: new URL(config.service.publicUrl).hostname,
				credential,
			});

			if (!verification.verified) {
				invalid(`Passkey verification failed`);
			}

			// update counter
			mfaManager.updateWebAuthnCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
		} catch {
			invalid(`Passkey verification failed`);
		}

		// create session
		const { session, token } = await webSessionManager.createWebSession({
			did: credential.did,
			remember: true, // passkey login implies trusted device
			userAgent: request.headers.get('user-agent') ?? undefined,
			ip: getServer().requestIP(request)?.address,
		});

		setWebSessionToken(request, token, {
			expires: session.expires_at,
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
		});

		redirect(data.redirect);
	},
);

export const verifyWebAuthnForm = form(
	v.object({
		challenge: v.string(),
		response: webauthnResponseSchema,
		redirect: v.string(),
	}),
	async (data) => {
		const { mfaManager, webSessionManager, config } = getAppContext();
		const { request } = getContext();

		const challenge = webSessionManager.getVerifyChallenge(data.challenge);
		if (challenge === null) {
			redirect(routes.login.index.href(undefined, { redirect: data.redirect }));
		}

		if (!challenge.webauthn_challenge) {
			invalid(`WebAuthn not initiated for this session`);
		}

		// find the credential being used
		const credential = mfaManager.getWebAuthnCredentialByCredentialId(data.response.id);
		if (credential === null || credential.did !== challenge.did) {
			invalid(`Invalid security key`);
		}

		try {
			const verification = await verifyWebAuthnAuthentication({
				response: data.response,
				expectedChallenge: challenge.webauthn_challenge,
				expectedOrigin: config.service.publicUrl,
				expectedRpId: new URL(config.service.publicUrl).hostname,
				credential,
			});

			if (!verification.verified) {
				invalid(`Security key verification failed`);
			}

			// update counter
			mfaManager.updateWebAuthnCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
		} catch {
			invalid(`Security key verification failed`);
		}

		const isSudo = challenge.session_id !== null;

		// delete challenge
		webSessionManager.deleteVerifyChallenge(data.challenge);

		if (isSudo) {
			// elevate session and redirect
			webSessionManager.elevateSession(challenge.session_id!);
			redirect(data.redirect);
		} else {
			// MFA login: create new session using remember preference from login
			const { session, token } = await webSessionManager.createWebSession({
				did: challenge.did,
				remember: challenge.remember,
				userAgent: request.headers.get('user-agent') ?? undefined,
				ip: getServer().requestIP(request)?.address,
			});

			setWebSessionToken(request, token, {
				expires: session.expires_at,
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
			});

			redirect(data.redirect);
		}
	},
);
