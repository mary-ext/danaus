import { signOperation, type UnsignedOperation } from '@atcute/did-plc';
import type { Did, Handle } from '@atcute/lexicons';
import { isHandle } from '@atcute/lexicons/syntax';
import { XRPCError } from '@atcute/xrpc-server';

import { HTTPException } from 'hono/http-exception';
import * as v from 'valibot';

import { parseAppPasswordPrivilege } from '#app/accounts/app-passwords.ts';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '#app/accounts/passwords.ts';
import { readWebSessionToken, setWebSessionToken, verifyWebSessionToken } from '#app/auth/web.ts';
import type { AppContext } from '#app/context.ts';
import { isHostnameSuffix } from '#app/utils/schema.ts';

import { form, getRequestContext, invalid, redirect } from '../forms/index.ts';

export const createAccountForms = (ctx: AppContext) => {
	const { accountManager } = ctx;

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

	/**
	 * creates an app password and returns the secret for display.
	 */
	const createAppPasswordForm = form(
		v.object({
			name: v.pipe(v.string(), v.minLength(1, `Name is required`), v.maxLength(32, `Name is too long`)),
			privilege: v.picklist(['limited', 'privileged', 'full'], `Invalid privilege`),
		}),
		async (data) => {
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
							invalid(`An app password with this name already exists`);
						}
						case 'TooManyAppPasswords': {
							invalid(`You've reached the maximum amount of app passwords allowed`);
						}
					}
				}

				throw err;
			}
		},
	);

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
		},
	);

	/**
	 * updates the account handle, including PLC document for did:plc accounts.
	 */
	const updateHandleForm = form(
		v.object({
			domain: v.union([v.pipe(v.string(), v.check(isHostnameSuffix)), v.literal('custom')]),
			handle: v.pipe(v.string(), v.minLength(1, `Handle is required`)),
		}),
		async (data) => {
			const { did } = verifyCredentials();

			let handle: Handle;
			if (data.domain === 'custom') {
				if (!isHandle(data.handle)) {
					invalid(`Invalid handle`);
				}

				handle = data.handle;
			} else {
				const fullHandle = `${data.handle}${data.domain}`;
				if (!isHandle(fullHandle)) {
					invalid(`Invalid handle`);
				}

				handle = fullHandle;
			}

			// validate the handle (checks TLD, service domain constraints, external domain resolution)
			try {
				handle = await accountManager.validateHandle(handle, { did });
			} catch (err) {
				if (err instanceof XRPCError && err.status === 400) {
					switch (err.error) {
						case 'InvalidHandle': {
							invalid(err.description ?? `Invalid handle`);
						}
						case 'UnsupportedDomain': {
							invalid(`Handle must resolve to your DID via DNS or .well-known`);
						}
					}
				}
				throw err;
			}

			// check if handle is already taken by another account
			const existing = accountManager.getAccount(handle, {
				includeDeactivated: true,
				includeTakenDown: true,
			});

			if (existing !== null) {
				if (existing.did === did) {
					return;
				}

				invalid(`Handle is already taken`);
			}

			// update PLC document for did:plc accounts
			if (did.startsWith('did:plc:')) {
				await updatePlcHandle(ctx, did as Did<'plc'>, handle);
			}

			// update local database and emit identity event
			accountManager.updateAccountHandle(did, handle);
			await ctx.sequencer.emitIdentity(did, handle);
		},
	);

	/**
	 * triggers identity event to refresh handle caches after verifying handle still resolves.
	 */
	const refreshHandleForm = form(v.object({}), async () => {
		const { did } = verifyCredentials();

		const account = accountManager.getAccount(did)!;
		if (!account.handle) {
			invalid(`Handle not set`);
		}

		// verify handle still resolves correctly
		try {
			await accountManager.validateHandle(account.handle, { did });
		} catch (err) {
			if (err instanceof XRPCError && err.status === 400) {
				switch (err.error) {
					case 'InvalidHandle': {
						invalid(err.description ?? `Handle is no longer valid`);
					}
					case 'UnsupportedDomain': {
						invalid(`Handle no longer resolves to your DID`);
					}
				}
			}
			throw err;
		}

		// emit identity event with current handle to trigger cache refresh
		await ctx.sequencer.emitIdentity(did, account.handle);
	});

	return {
		signInForm,
		createAppPasswordForm,
		deleteAppPasswordForm,
		updateHandleForm,
		refreshHandleForm,
	};
};

/**
 * updates the handle in a did:plc document.
 * @param ctx app context
 * @param did the did:plc to update
 * @param handle the new handle
 */
async function updatePlcHandle(ctx: AppContext, did: Did<'plc'>, handle: Handle): Promise<void> {
	const { plcClient, config } = ctx;

	// get current state and last operation CID
	const auditLog = await plcClient.getAuditLog(did);
	const lastEntry = auditLog[auditLog.length - 1];
	if (!lastEntry) {
		throw new Error(`no operations found for ${did}`);
	}

	const state = await plcClient.getState(did);

	// build update operation with new handle
	const unsignedOp: UnsignedOperation = {
		type: 'plc_operation',
		prev: lastEntry.cid,
		alsoKnownAs: [`at://${handle}`],
		rotationKeys: state.rotationKeys,
		verificationMethods: state.verificationMethods,
		services: state.services,
	};

	// sign with PDS rotation key
	const signedOp = await signOperation(unsignedOp, config.secrets.plcRotationKey);

	// submit to PLC directory
	await plcClient.submitOperation(did, signedOp);
}
