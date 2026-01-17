import type { Did } from '@atcute/lexicons';
import { XRPCError } from '@atcute/xrpc-server';
import { redirect } from '@oomfware/fetch-router';
import { getContext } from '@oomfware/fetch-router/middlewares/async-context';
import { form, invalid } from '@oomfware/forms';

import * as v from 'valibot';

import type { Account } from '#app/accounts/manager.ts';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '#app/accounts/passwords.ts';
import { isRecoveryCode, isTotpCode } from '#app/accounts/totp.ts';
import { setWebSessionToken } from '#app/auth/web.ts';

import { getAppContext } from '#web/middlewares/app-context.ts';
import { getSession } from '#web/middlewares/session.ts';
import { routes } from '#web/routes.ts';

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
	const { accountManager } = getAppContext();
	const { did, factor, code, allowedFactors } = options;

	if (!allowedFactors.includes(factor)) {
		invalid(`Invalid authentication method`);
	}

	switch (factor) {
		case 'totp': {
			if (!isTotpCode(code)) {
				invalid(`Invalid verification code`);
			}

			const valid = await accountManager.verifyAccountTotpCode(did, code);
			if (!valid) {
				invalid(`Invalid verification code`);
			}

			break;
		}
		case 'recovery': {
			if (!isRecoveryCode(code)) {
				invalid(`Invalid recovery code`);
			}

			const valid = accountManager.consumeRecoveryCode(did, code);
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
		const { accountManager } = getAppContext();
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

		// clean up any expired MFA challenges
		accountManager.cleanupExpiredMfaChallenges();

		// check if MFA is enabled
		if (accountManager.getMfaStatus(account.did) !== null) {
			// create MFA challenge and redirect
			const token = accountManager.createMfaChallenge(account.did);

			redirect(routes.login.mfa.index.href(undefined, { token, redirect: data.redirect }));
		}

		const { session, token } = await accountManager.createWebSession({
			did: account.did,
			remember: data.remember ?? false,
			userAgent: request.headers.get('user-agent') ?? undefined,
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

export const verifyMfaLoginForm = form(
	v.object({
		challenge: v.string(),
		factor: v.picklist<AuthFactor[]>(['totp', 'recovery']),
		_code: v.string(),
		remember: v.optional(v.boolean(), false),
		redirect: v.string(),
	}),
	async (data) => {
		const { accountManager } = getAppContext();
		const { request } = getContext();

		const challenge = accountManager.getMfaChallenge(data.challenge);
		if (challenge === null) {
			redirect(routes.login.show.href(undefined, { redirect: data.redirect }));
		}

		await verifyFactor({
			did: challenge.did,
			factor: data.factor,
			code: data._code,
			allowedFactors: ['totp', 'recovery'],
		});

		accountManager.deleteMfaChallenge(data.challenge);

		const { session, token } = await accountManager.createWebSession({
			did: challenge.did,
			remember: data.remember ?? false,
			userAgent: request.headers.get('user-agent') ?? undefined,
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

const authenticationResponseSchema = v.object({
	id: v.string(),
	rawId: v.string(),
	response: v.object({
		clientDataJSON: v.string(),
		authenticatorData: v.string(),
		signature: v.string(),
		userHandle: v.optional(v.string()),
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
	type: v.literal('public-key'),
});

export const verifyWebAuthnMfaForm = form(
	v.object({
		challenge: v.string(),
		response: v.pipe(v.string(), v.minLength(1), v.parseJson(), authenticationResponseSchema),
		remember: v.optional(v.boolean(), false),
		redirect: v.string(),
	}),
	async (data) => {
		const { accountManager, config } = getAppContext();
		const { request } = getContext();

		const mfaChallenge = accountManager.getMfaChallenge(data.challenge);
		if (mfaChallenge === null) {
			redirect(routes.login.show.href(undefined, { redirect: data.redirect }));
		}

		if (!mfaChallenge.webauthn_challenge) {
			invalid(`WebAuthn not initiated for this session`);
		}

		// find the credential being used
		const credential = accountManager.getWebAuthnCredentialByCredentialId(data.response.id);
		if (credential === null || credential.did !== mfaChallenge.did) {
			invalid(`Invalid security key`);
		}

		// verify the authentication response
		const { verifyWebAuthnAuthentication } = await import('#app/accounts/webauthn.ts');

		try {
			const verification = await verifyWebAuthnAuthentication({
				response: data.response,
				expectedChallenge: mfaChallenge.webauthn_challenge,
				expectedOrigin: config.service.publicUrl,
				expectedRpId: new URL(config.service.publicUrl).hostname,
				credential,
			});

			if (!verification.verified) {
				invalid(`Security key verification failed`);
			}

			// update counter
			accountManager.updateWebAuthnCredentialCounter(
				credential.id,
				verification.authenticationInfo.newCounter,
			);
		} catch {
			invalid(`Security key verification failed`);
		}

		accountManager.deleteMfaChallenge(data.challenge);

		const { session, token } = await accountManager.createWebSession({
			did: mfaChallenge.did,
			remember: data.remember ?? false,
			userAgent: request.headers.get('user-agent') ?? undefined,
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

const SUDO_ALLOWED_MFA_FACTORS: AuthFactor[] = ['totp', 'webauthn', 'recovery'];
const SUDO_ALLOWED_OFA_FACTORS: AuthFactor[] = ['password'];

export const verifySudoForm = form(
	v.object({
		factor: v.picklist<AuthFactor[]>(['totp', 'recovery', 'password']),
		_code: v.string(),
		redirect: v.pipe(v.string(), v.minLength(1)),
	}),
	async (data) => {
		const { accountManager } = getAppContext();
		const session = getSession();

		// determine allowed factors based on MFA status
		const hasMfa = accountManager.getMfaStatus(session.did) !== null;
		const allowedFactors = hasMfa ? SUDO_ALLOWED_MFA_FACTORS : SUDO_ALLOWED_OFA_FACTORS;

		await verifyFactor({
			did: session.did,
			factor: data.factor,
			code: data._code,
			allowedFactors,
		});

		// elevate session and redirect
		accountManager.elevateSession(session.id);
		redirect(data.redirect);
	},
);

const sudoAuthenticationResponseSchema = v.object({
	id: v.string(),
	rawId: v.string(),
	response: v.object({
		clientDataJSON: v.string(),
		authenticatorData: v.string(),
		signature: v.string(),
		userHandle: v.optional(v.string()),
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
	type: v.literal('public-key'),
});

export const verifyWebAuthnSudoForm = form(
	v.object({
		challenge: v.string(),
		response: v.pipe(v.string(), v.minLength(1), v.parseJson(), sudoAuthenticationResponseSchema),
		redirect: v.pipe(v.string(), v.minLength(1)),
	}),
	async (data) => {
		const { accountManager, config } = getAppContext();
		const session = getSession();

		if (accountManager.getMfaStatus(session.did) === null) {
			redirect(routes.login.sudo.index.href(undefined, { redirect: data.redirect }));
		}

		const sudoChallenge = accountManager.getWebAuthnChallenge(data.challenge);
		if (sudoChallenge === null || sudoChallenge.did !== session.did) {
			invalid(`Invalid or expired challenge`);
		}

		// find the credential being used
		const credential = accountManager.getWebAuthnCredentialByCredentialId(data.response.id);
		if (credential === null || credential.did !== session.did) {
			invalid(`Invalid security key`);
		}

		// verify the authentication response
		const { verifyWebAuthnAuthentication } = await import('#app/accounts/webauthn.ts');

		try {
			const verification = await verifyWebAuthnAuthentication({
				response: data.response,
				expectedChallenge: sudoChallenge.challenge,
				expectedOrigin: config.service.publicUrl,
				expectedRpId: new URL(config.service.publicUrl).hostname,
				credential,
			});

			if (!verification.verified) {
				invalid(`Security key verification failed`);
			}

			// update counter
			accountManager.updateWebAuthnCredentialCounter(
				credential.id,
				verification.authenticationInfo.newCounter,
			);
		} catch {
			invalid(`Security key verification failed`);
		}

		// clean up the challenge
		accountManager.deleteWebAuthnChallenge(data.challenge);

		// elevate session and redirect
		accountManager.elevateSession(session.id);
		redirect(data.redirect);
	},
);
