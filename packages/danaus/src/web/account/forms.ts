import { PlcClientError, signOperation, type UnsignedOperation } from '@atcute/did-plc';
import type { Did, Handle } from '@atcute/lexicons';
import { isHandle } from '@atcute/lexicons/syntax';
import { XRPCError } from '@atcute/xrpc-server';
import { form, invalid } from '@oomfware/forms';

import * as v from 'valibot';

import { parseAppPasswordPrivilege } from '#app/accounts/app-passwords.ts';
import type { AppContext } from '#app/context.ts';
import { isHostnameSuffix } from '#app/utils/schema.ts';

import { getAppContext } from '../middlewares/app-context.ts';
import { getSession } from '../middlewares/session.ts';

/**
 * creates an app password and returns the secret for display.
 */
export const createAppPasswordForm = form(
	v.object({
		name: v.pipe(v.string(), v.minLength(1, `Name is required`), v.maxLength(32, `Name is too long`)),
		privilege: v.picklist(['limited', 'privileged', 'full'], `Invalid privilege`),
	}),
	async (data) => {
		const { legacyAuthManager } = getAppContext();
		const session = getSession();

		const privilege = parseAppPasswordPrivilege(data.privilege);

		try {
			const { appPassword, secret } = await legacyAuthManager.createAppPassword({
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
 * deletes an app password.
 */
export const deleteAppPasswordForm = form(
	v.object({
		name: v.pipe(v.string(), v.minLength(1)),
	}),
	async (data) => {
		const { legacyAuthManager } = getAppContext();
		const session = getSession();

		legacyAuthManager.deleteAppPassword(session.did, data.name);
	},
);

/**
 * updates the account handle, including PLC document for did:plc accounts.
 */
export const updateHandleForm = form(
	v.object({
		domain: v.union([v.pipe(v.string(), v.check(isHostnameSuffix)), v.literal('custom')]),
		handle: v.pipe(v.string(), v.minLength(1, `Handle is required`)),
	}),
	async (data) => {
		const ctx = getAppContext();

		const { accountManager, sequencer } = ctx;
		const { did } = getSession();

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
						invalid(err.message ?? `Invalid handle`);
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
			try {
				// oxlint-disable-next-line no-unsafe-type-assertion -- narrowed by startsWith check
				await updatePlcHandle(ctx, did as Did<'plc'>, handle);
			} catch (err) {
				if (err instanceof PlcClientError) {
					invalid(`Unable to update DID document, please try again later`);
				}

				throw err;
			}
		}

		// update local database and emit identity event
		accountManager.updateAccountHandle(did, handle);
		await sequencer.emitIdentity(did, handle);
	},
);

/**
 * triggers identity event to refresh handle caches after verifying handle still resolves.
 */
export const refreshHandleForm = form(v.object({}), async () => {
	const { accountManager, sequencer } = getAppContext();
	const { did } = getSession();

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
					invalid(err.message ?? `Handle is no longer valid`);
				}
				case 'UnsupportedDomain': {
					invalid(`Handle no longer resolves to your DID`);
				}
			}
		}
		throw err;
	}

	// emit identity event with current handle to trigger cache refresh
	await sequencer.emitIdentity(did, account.handle);
});

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

	// sign with PDS rotation key and submit to PLC directory
	const signedOp = await signOperation(unsignedOp, config.secrets.plcRotationKey);
	await plcClient.submitOperation(did, signedOp);
}
