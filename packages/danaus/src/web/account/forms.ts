import { XRPCError } from '@atcute/xrpc-server';

import { HTTPException } from 'hono/http-exception';
import * as v from 'valibot';

import { parseAppPasswordPrivilege } from '#app/accounts/app-passwords.ts';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '#app/accounts/passwords.ts';
import { readWebSessionToken, setWebSessionToken, verifyWebSessionToken } from '#app/auth/web.ts';
import type { AppContext } from '#app/context.ts';

import { form, getRequestContext, invalid, redirect } from '../forms/index.ts';

export const createAccountForms = (ctx: AppContext) => {
	const { accountManager } = ctx;

	// #region verify credentials helper
	const verifyCredentials = () => {
		const c = getRequestContext();
		const token = readWebSessionToken(c.req.raw);
		if (!token) {
			throw new HTTPException(302, {
				res: c.redirect(`/account/login?redirect=${encodeURIComponent(c.req.path)}`),
			});
		}

		const sessionId = verifyWebSessionToken(ctx.config.secrets.jwtKey, token);
		if (!sessionId) {
			throw new HTTPException(302, {
				res: c.redirect(`/account/login?redirect=${encodeURIComponent(c.req.path)}`),
			});
		}

		const session = accountManager.getWebSession(sessionId);
		if (!session) {
			throw new HTTPException(302, {
				res: c.redirect(`/account/login?redirect=${encodeURIComponent(c.req.path)}`),
			});
		}

		return session;
	};
	// #endregion

	// #region sign-in form
	/**
	 * validates credentials, creates session, sets cookie, and redirects.
	 */
	const signInForm = form(
		v.object({
			identifier: v.pipe(v.string(), v.minLength(1, `Enter your email or username`)),
			password: v.pipe(v.string(), v.minLength(1, `Enter your password`)),
			remember: v.optional(v.boolean()),
			redirect: v.optional(v.string()),
		}),
		async (data, issue) => {
			const c = getRequestContext();

			if (data.password.length < MIN_PASSWORD_LENGTH || data.password.length > MAX_PASSWORD_LENGTH) {
				invalid(issue.identifier(`Invalid account credentials`));
			}

			const account = await accountManager.verifyAccountPassword(data.identifier, data.password);
			if (account === null) {
				invalid(issue.identifier(`Invalid account credentials`));
			}

			const { session, token } = await accountManager.createWebSession({
				did: account.did,
				remember: data.remember ?? false,
				userAgent: c.req.header('user-agent'),
			});

			setWebSessionToken(c.req.raw, token, {
				expires: session.expires_at,
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
			});

			redirect(302, data.redirect ?? '/account');
		},
	);
	// #endregion

	// #region create app password form
	/**
	 * creates an app password and returns the secret for display.
	 */
	const createAppPasswordForm = form(
		v.object({
			name: v.pipe(v.string(), v.minLength(1, `Name is required`), v.maxLength(32, `Name is too long`)),
			privilege: v.picklist(['limited', 'privileged', 'full'], `Invalid privilege`),
		}),
		async (data, issue) => {
			const session = verifyCredentials();
			const privilege = parseAppPasswordPrivilege(data.privilege);

			try {
				const { appPassword, secret } = await accountManager.createAppPassword({
					did: session.did,
					name: data.name,
					privilege,
				});

				return { name: appPassword.name, secret };
			} catch (err) {
				if (err instanceof XRPCError && err.status === 400) {
					switch (err.error) {
						case 'DuplicateAppPassword': {
							invalid(issue.name(`An app password with this name already exists`));
						}
						case 'TooManyAppPasswords': {
							invalid(issue.name(`You've reached the maximum amount of app passwords allowed`));
						}
					}
				}

				throw err;
			}
		},
	);
	// #endregion

	// #region delete app password form
	/**
	 * deletes an app password and redirects back to the list.
	 */
	const deleteAppPasswordForm = form(
		v.object({
			name: v.pipe(v.string(), v.minLength(1)),
		}),
		async (data) => {
			const session = verifyCredentials();

			accountManager.deleteAppPassword(session.did, data.name);
			redirect(302, '/account/app-passwords');
		},
	);
	// #endregion

	return { signInForm, createAppPasswordForm, deleteAppPasswordForm };
};
